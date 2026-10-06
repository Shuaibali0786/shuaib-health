import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { signIn } from "./admin-helpers";

// The Overview against the mock API (Feature 006, US3), with the clock paused at Mon 5 Oct 2026, 11:20:45
// in the clinic. The numbers come from the demo day the backend generator produced
// (tests/fixtures/admin/demo-day.json), so what is asserted here is what the demo shows.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now); // 11:20:45 in the clinic
const overview = fixture.overview;

type Item = { reference: string; localTime: string; status: string; patientNameMasked: string; doctor: { name: string; departmentName: string } };
const bookings: Item[] = overview.agenda.flatMap((row: { items: Item[] }) => row.items);

const initials = (masked: string) => {
  const words = masked.split(/\s+/);
  return (words.length === 1 ? [words[0]] : [words[0], words.at(-1)]).map((w) => `${w![0]!.toUpperCase()}.`).join("");
};
const phrase = (delta: number, unit = "") => (delta === 0 ? "same as last Mon" : `${delta > 0 ? "up" : "down"} ${Math.abs(delta)}${unit} on last Mon`);

/** The clock stands still at 11:20:45 before the page loads, so nothing moves until a test moves it. */
async function openOverview(page: Page) {
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
  await page.goto("/admin");
  await expect(page.getByTestId("status-mix")).toBeVisible();
}

/** The control that opens a booking: a chip on the timeline, a row in a doctor's list on a phone. */
const opener = (page: Page, reference: string): Locator => page.locator(`.tl-b[data-ref="${reference}"]:visible, .m-row[data-ref="${reference}"]:visible`).first();

/** Opens every doctor's panel on a phone (only the doctor with the next patient starts open). */
async function openPanels(page: Page) {
  const panels = page.locator("details.m-doc:visible");
  for (let i = 0; i < (await panels.count()); i += 1) {
    const panel = panels.nth(i);
    if ((await panel.getAttribute("open")) === null) await panel.locator("summary").click();
  }
}

const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

test.describe("the demo day", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("greets by the clinic hour and shows the six KPIs with their trends", async ({ page }) => {
    await openOverview(page);
    await expect(page.getByRole("heading", { level: 1, name: "Good morning" })).toBeVisible();
    await expect(page.locator("#page-sub")).toHaveText("Today at the clinic · Monday 5 October 2026");

    const kpis: [string, string, number, string][] = [
      ["appointments", "Appointments", overview.kpis.appointments.value, phrase(overview.kpis.appointments.delta)],
      ["arrived", "Arrived", overview.kpis.arrived.value, phrase(overview.kpis.arrived.delta)],
      ["completed", "Completed", overview.kpis.completed.value, phrase(overview.kpis.completed.delta)],
      ["noShows", "No-shows", overview.kpis.noShows.value, phrase(overview.kpis.noShows.delta)],
      ["cancellations", "Cancellations", overview.kpis.cancellations.value, phrase(overview.kpis.cancellations.delta)],
      ["utilisationPct", "Chair utilisation", overview.kpis.utilisationPct.value, phrase(overview.kpis.utilisationPct.delta, " pts")],
    ];
    for (const [key, label, value, words] of kpis) {
      const card = page.locator(`[data-kpi="${key}"]`);
      await expect(card.locator(".label")).toHaveText(label);
      await expect(card.getByTestId("count-final")).toHaveText(`${value}${key === "utilisationPct" ? "%" : ""}`);
      await expect(card.locator(".kfoot .sr-only")).toHaveText(words);
    }
    // The numbers on screen reach their final value once the clock runs for a second.
    await page.clock.runFor(1000);
    await expect(page.locator('[data-kpi="appointments"] [data-testid="count-visual"]')).toHaveText(String(overview.kpis.appointments.value));
  });

  test("lists the doctors working today with a chip per booking", async ({ page, isMobile }) => {
    await openOverview(page);
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    const doctors = overview.agenda.length;
    await expect(page.locator("#ag-meta, .m-only .card-head .meta").locator("visible=true").first()).toContainText(isMobile ? `${doctors} doctors` : `${doctors} doctors working · ${bookings.length} bookings incl. ${cancelled} cancelled`);
    if (isMobile) {
      await expect(page.locator("details.m-doc:visible")).toHaveCount(doctors);
      return;
    }
    for (const row of overview.agenda as { doctor: { name: string; departmentName: string }; items: Item[] }[]) {
      const lane = page.getByRole("group", { name: `${row.doctor.name}, ${row.doctor.departmentName}` });
      await expect(lane).toBeVisible();
      await expect(lane.getByRole("button")).toHaveCount(row.items.length);
    }
    const first = bookings.find((b) => b.status === "confirmed")!;
    await expect(page.getByRole("button", { name: `${first.localTime}, patient ${initials(first.patientNameMasked)}, Confirmed. Open booking.` }).first()).toBeVisible();
  });

  test("a chip shows its time, initials and status on focus, opens the booking on Enter and gives focus back on Escape", async ({ page, isMobile }) => {
    test.skip(isMobile, "chips are the wide-screen agenda; phones have their own rows");
    await openOverview(page);
    const target = overview.nextUp[0] as Item;
    const chip = opener(page, target.reference);
    await chip.focus();
    await expect(page.getByRole("tooltip")).toHaveText(new RegExp(`${target.localTime}\\s+${initials(target.patientNameMasked).replace(/\./g, "\\.")}\\s+Confirmed`));
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toContainText(`Booking ${target.reference}`);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("hovering a chip shows the tooltip, which stays while the pointer is on it and goes with Escape", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is a pointer interaction");
    await openOverview(page);
    const target = overview.nextUp[1] as Item;
    await opener(page, target.reference).hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    const box = (await tip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.clock.runFor(500);
    await expect(tip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip).toHaveCount(0);
  });

  test("on a phone, a doctor's rows open the booking and the Now line sits before the next patient", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the collapsible list is the phone agenda");
    await openOverview(page);
    await expect(page.getByTestId("now-row")).toHaveText("Now 11:20");
    await openPanels(page);
    const target = overview.nextUp[0] as Item;
    await opener(page, target.reference).click();
    await expect(drawer(page)).toContainText(`Booking ${target.reference}`);
  });

  test("lists the next five patients and Mark arrived asks first, then moves every card, and Undo puts it back", async ({ page }) => {
    await openOverview(page);
    const list = page.getByTestId("next-up");
    const rows = list.locator("li");
    await expect(rows).toHaveCount(5);
    for (const [index, expected] of (overview.nextUp as Item[]).entries()) {
      await expect(rows.nth(index)).toContainText(expected.localTime);
      await expect(rows.nth(index)).toContainText(expected.patientNameMasked);
      await expect(rows.nth(index)).toContainText(expected.doctor.departmentName);
    }
    const first = overview.nextUp[0] as Item;
    await rows.first().getByRole("button", { name: /Mark .* as arrived/ }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(`Mark ${first.patientNameMasked} as arrived for ${first.localTime}?`);
    await confirm.getByRole("button", { name: "Not now" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.locator('[data-kpi="arrived"]').getByTestId("count-final")).toHaveText(String(overview.kpis.arrived.value));

    await rows.first().getByRole("button", { name: /Mark .* as arrived/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Mark arrived" }).click();
    await expect(page.getByTestId("undo-toast")).toContainText(`Marked ${first.patientNameMasked} as arrived.`);
    await expect(page.locator('[data-kpi="arrived"]').getByTestId("count-final")).toHaveText(String(overview.kpis.arrived.value + 1));
    await expect(list.locator(`li[data-ref="${first.reference}"]`)).toHaveCount(0);
    await expect(page.locator('[data-testid="status-mix"] [data-status="arrived"] .n')).toHaveText(String(bookings.filter((b) => b.status === "arrived").length + 1));

    await page.getByTestId("undo-toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator('[data-kpi="arrived"]').getByTestId("count-final")).toHaveText(String(overview.kpis.arrived.value));
    await expect(list.locator(`li[data-ref="${first.reference}"]`)).toHaveCount(1);
  });

  test("shows today by status with a count and a share for each", async ({ page }) => {
    await openOverview(page);
    const mix = page.getByTestId("status-mix");
    for (const status of ["completed", "arrived", "confirmed", "no_show", "cancelled"]) {
      const count = bookings.filter((b) => b.status === status).length;
      await expect(mix.locator(`[data-status="${status}"] .n`)).toHaveText(String(count));
      await expect(mix.locator(`[data-status="${status}"] .pc`)).toHaveText(`${Math.round((count / bookings.length) * 100)}%`);
    }
    await expect(mix.getByRole("img")).toHaveAttribute("aria-label", new RegExp(`^Status of today's ${bookings.length} bookings: `));
  });

  test("opens a booking from a chip or a row with its details", async ({ page }) => {
    await openOverview(page);
    await openPanels(page).catch(() => {});
    const target = overview.nextUp[2] as Item;
    await opener(page, target.reference).click();
    await expect(drawer(page)).toContainText(`Booking ${target.reference}`);
    await expect(drawer(page).getByTestId("phone")).toHaveText(/^\d{4}\*{4}\d{3}$/);
    await expect(drawer(page).getByRole("button", { name: "Mark arrived" })).toBeVisible();
  });
});

test.describe("states", () => {
  test("a day with no bookings says so and lists no one", async ({ page, context, baseURL }) => {
    await signIn(context, "empty", baseURL!);
    await openOverview(page);
    await expect(page.getByRole("heading", { name: "No bookings today" }).first()).toBeVisible();
    await expect(page.getByText("No more confirmed patients today.")).toBeVisible();
    await expect(page.locator('[data-kpi="appointments"]').getByTestId("count-final")).toHaveText("0");
    await expect(page.getByTestId("status-mix").locator('[data-status="confirmed"] .n')).toHaveText("0");
    await expect(page.locator(".tl-b")).toHaveCount(0);
  });

  test("a clinic holiday says the clinic is closed and why", async ({ page, context, baseURL }) => {
    await signIn(context, "closed", baseURL!);
    await openOverview(page);
    await expect(page.getByRole("heading", { name: "The clinic is closed today" }).first()).toBeVisible();
    await expect(page.getByText("Founders Day. There are no appointments to show.").first()).toBeVisible();
    await expect(page.locator('[data-kpi="utilisationPct"]').getByText("Not available, no scheduled slots today")).toHaveCount(1);
  });
});

test.describe("quality", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("has no sideways scroll and no axe violations", async ({ page }) => {
    await openOverview(page);
    await page.clock.runFor(1000);
    await page.clock.resume(); // axe uses timers of its own
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // The timeline chips are one 15-minute slot wide (about 21 px at 1440), as in the approved preview; WCAG 2.2
    // target size (24 px) is therefore checked for everything except them. Reported as an open decision (see results.md).
    const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
    const results = await new AxeBuilder({ page }).withTags(tags).disableRules(["target-size"]).analyze();
    const sizes = await new AxeBuilder({ page }).withRules(["target-size"]).exclude(".tl-b").analyze();
    const lines = (r: typeof results) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
    expect([...lines(results), ...lines(sizes)]).toEqual([]);
  });
});
