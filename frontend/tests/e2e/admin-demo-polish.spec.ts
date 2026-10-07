import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, runUntilNewBookingToast, signIn } from "./admin-helpers";

// Demo polish (Feature 006, after Phase 6): the typical clinic day, one-line KPI trends, the gold demo button,
// one set of booking counts, sample sign-ins, the View button and the same content width on every page.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now); // Mon 5 Oct 2026, 11:20:45 in the clinic

test.describe("the typical clinic day", () => {
  test("a demo outside clinic hours says so next to the clock", async ({ page, context, baseURL }) => {
    await signIn(context, "demoTypical", baseURL!);
    await page.goto("/admin");
    await expect(page.getByTestId("typical-day")).toHaveText("Showing a typical clinic day");
    await expect(page.locator(".statusbar .clock")).toContainText("12:30");
  });

  test("a demo inside clinic hours and a staff session do not show the label", async ({ page, context, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await expect(page.getByTestId("status-mix")).toBeVisible();
    await expect(page.getByTestId("typical-day")).toHaveCount(0);
    await context.clearCookies();
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin");
    await expect(page.getByTestId("status-mix")).toBeVisible();
    await expect(page.getByTestId("typical-day")).toHaveCount(0);
  });
});

test.describe("KPI cards", () => {
  test("every trend line fits on one line, untruncated", async ({ page, context, baseURL, isMobile }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await expect(page.getByTestId("status-mix")).toBeVisible();
    const feet = page.locator(".kpi .kfoot");
    await expect(feet).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      const foot = feet.nth(index);
      const label = await page.locator(".kpi .label").nth(index).innerText();
      const box = await foot.boundingBox();
      expect(box!.height, `${label}: one line`).toBeLessThanOrEqual(30);
      const fits = await foot.evaluate((el) => {
        const row = el.getBoundingClientRect();
        return [...el.children].filter((child) => !child.classList.contains("sr-only")).every((child) => child.getBoundingClientRect().bottom <= row.bottom + 1 && child.scrollWidth <= child.clientWidth + 1 && child.getBoundingClientRect().right <= row.right + 1);
      });
      expect(fits, `${label}: nothing cut or wrapped`).toBe(true);
      if (!isMobile) await expect(foot.locator(".vs")).toBeVisible();
    }
  });
});

test.describe("the sign-in page", () => {
  test("offers the demo as a prominent gold button", async ({ page }) => {
    await page.goto("/admin/login");
    const button = page.getByRole("button", { name: "View Demo Dashboard" });
    await expect(button).toBeVisible();
    await expect(button).toHaveClass(/btn-gold/);
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    const card = await page.locator(".auth-card").boundingBox();
    expect(box!.width).toBeGreaterThan(card!.width * 0.7); // full width, not a text link
    const background = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    expect(background).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("staff page", () => {
  test("is as wide as the Overview", async ({ page, context, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await expect(page.getByTestId("status-mix")).toBeVisible();
    const overview = await page.locator("main .kpis").boundingBox();
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "People with access" })).toBeVisible();
    const staff = await page.locator("main section.card").first().boundingBox();
    expect(Math.abs(staff!.width - overview!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(staff!.x - overview!.x)).toBeLessThanOrEqual(1);
  });

  test("shows sample sign-ins in the past, without seconds", async ({ page, context, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/staff");
    const cells = page.locator("td[data-label='Last sign-in']");
    await expect(cells.first()).toBeVisible();
    const texts = await cells.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text, text).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} [AP]M$/);
    expect(texts[0]).toBe("Mon 5 Oct, 7:52 AM"); // the clinic manager, before the 11:20 "now"
  });
});

test.describe("one set of numbers", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  /** The number in "N bookings" of the Today-by-status card. */
  const mixTotal = async (page: Page) => Number(/^(\d+)/.exec(await page.locator("#mx-meta").innerText())![1]);

  test("Overview, Today by status and Bookings count the same bookings, with a simulated booking and a status change", async ({ page, isMobile }) => {
    await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
    await page.clock.pauseAt(NOW);
    await page.goto("/admin");
    await revealStreamedContent(page);
    await expect(page.getByTestId("status-mix")).toBeVisible();
    const before = await mixTotal(page);
    expect(before).toBe(fixture.overview.agenda.flatMap((row: { items: unknown[] }) => row.items).length);

    // 50 s later the demo simulates an online booking; every number on the Overview moves together.
    await runUntilNewBookingToast(page);
    await page.clock.resume();
    await expect.poll(() => mixTotal(page)).toBe(before + 1);
    if (!isMobile) await expect(page.locator("#ag-meta")).toContainText(`${before + 1} bookings`);
    const cancelled = Number(await page.locator('[data-testid="status-mix"] li[data-status="cancelled"] .n').innerText());
    const appointments = Number(await page.locator('[data-kpi="appointments"]').getByTestId("count-final").innerText());
    expect(appointments + cancelled).toBe(before + 1);

    // The Bookings screen (client-side navigation keeps the simulated booking) counts the same day.
    await page.getByRole("link", { name: "Bookings", exact: true }).and(page.locator(":visible")).first().click();
    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.getByTestId("bookings-summary")).toContainText(`Today · ${before + 1} bookings`);
    const chips = page.locator(".chips:visible").first();
    await expect(chips.locator(".chip", { hasText: /^All/ })).toContainText(String(before + 1));
    const counts = await chips.locator(".chip .c").allInnerTexts();
    const [all, ...byStatus] = counts.map(Number);
    expect(byStatus.reduce((a, b) => a + b, 0)).toBe(all);
    expect(all).toBe(before + 1);
    await expect(page.getByTestId("page-count").first()).toContainText(`of ${before + 1} bookings`);
  });
});

test.describe("the bookings table", () => {
  test("every row has a View button that opens the booking drawer", async ({ page, context, baseURL, isMobile }) => {
    test.skip(isMobile, "the View button is part of the desktop table");
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/bookings");
    await page.waitForLoadState("networkidle");
    const rows = page.locator("table.bk tbody tr");
    await expect(rows.first()).toBeVisible();
    const total = await rows.count();
    await expect(page.locator("table.bk tbody tr [data-view]")).toHaveCount(total);
    await expect(page.locator("table.bk tbody tr", { hasText: "—" })).toHaveCount(0);
    const first = rows.first();
    const reference = await first.getAttribute("data-ref");
    await first.getByRole("button", { name: /^View booking/ }).click();
    const drawer = page.getByRole("dialog").filter({ has: page.locator(".dr-head") });
    await expect(drawer).toContainText(`Booking ${reference}`);
  });
});
