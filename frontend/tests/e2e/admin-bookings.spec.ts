import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { signIn } from "./admin-helpers";

// The Bookings screen against the mock API (Feature 006, US4): find, open, move through status with a
// confirmation and an Undo, reveal a phone number, a stale change refused, and the demo's browser-only
// changes. The admin projects run in parallel against one mock server, so every staff test books its own
// fresh appointment (`/__admin/new-booking`) and never touches another test's.

const MOCK = "http://127.0.0.1:4010";
const NOW = new Date("2026-10-05T06:20:45Z"); // Mon 5 Oct, 11:20:45 in the clinic

async function freshBooking(request: APIRequestContext, name = "Test Patient"): Promise<string> {
  const response = await request.post(`${MOCK}/__admin/new-booking`, { data: { name, minutesFromNow: 20 } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { reference: string }).reference;
}

/** Waits for hydration: the first click or keystroke on a server-rendered page must be handled. */
async function openBookings(page: Page, query = "") {
  await page.goto(`/admin/bookings${query}`);
  await page.waitForLoadState("networkidle");
}

/** The search box that is on screen (the desktop and the phone layout each have one). */
const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search reference or patient name" }).and(page.locator(":visible"));

async function find(page: Page, reference: string) {
  await searchBox(page).fill(reference.slice(-6));
  await expect(page.locator(`[data-ref="${reference}"]:visible`).first()).toBeVisible();
}

/** The control that opens the drawer: the patient name in the table, the card on a phone. */
const opener = (page: Page, reference: string) => page.locator(`tr[data-ref="${reference}"] .pt-open:visible, button.bcard[data-ref="${reference}"]:visible`).first();

const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

async function changeStatus(page: Page, actionName: string) {
  await drawer(page).getByRole("button", { name: actionName }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: actionName }).click();
  await expect(confirm).toBeHidden();
}

const toast = (page: Page) => page.getByTestId("undo-toast");

test.describe("staff", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "receptionist", baseURL!));

  test("find by reference, mark arrived with an undo, then arrived again and completed, in under 15 seconds", async ({ page, request }) => {
    const reference = await freshBooking(request);
    await page.clock.install({ time: NOW });
    await openBookings(page);

    const started = Date.now();
    await find(page, reference);
    await opener(page, reference).click();
    await expect(drawer(page)).toContainText(`Booking ${reference}`);
    await expect(drawer(page).getByTestId("phone")).toHaveText(/^\d{4}\*{4}\d{3}$/);

    await changeStatus(page, "Mark arrived");
    await expect(toast(page)).toContainText("Marked Test P. as arrived.");
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Arrived");

    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(toast(page)).toBeHidden();
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Confirmed");

    await changeStatus(page, "Mark arrived");
    await changeStatus(page, "Mark completed");
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Completed");
    await expect(drawer(page)).toContainText("Final status");
    const seconds = (Date.now() - started) / 1000;
    test.info().annotations.push({ type: "SC-003", description: `${seconds.toFixed(1)} s from search to Completed` });
    expect(seconds).toBeLessThan(15);

    // The history lists the changes and the undo, with who made them.
    await expect(drawer(page).locator(".history li")).toHaveCount(5);
    await expect(drawer(page).locator(".history")).toContainText("Sample Receptionist A");
  });

  test("the quick action in the list also asks first", async ({ page, request, isMobile }) => {
    test.skip(isMobile, "the quick action is part of the desktop table");
    const reference = await freshBooking(request, "Quick Patient");
    await openBookings(page);
    await find(page, reference);
    await page.locator(`tr[data-ref="${reference}"]`).getByRole("button", { name: /^Arrived/ }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Mark Quick P. as arrived for");
    await expect(confirm.getByRole("button", { name: "Not now" })).toBeFocused();
    await confirm.getByRole("button", { name: "Not now" }).click();
    await expect(page.locator(`tr[data-ref="${reference}"] .pill`)).toHaveText("Confirmed");
    await page.locator(`tr[data-ref="${reference}"]`).getByRole("button", { name: /^Arrived/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Mark arrived" }).click();
    await expect(page.locator(`tr[data-ref="${reference}"] .pill`)).toHaveText("Arrived");
    await expect(page.locator(`tr[data-ref="${reference}"]`).getByRole("button", { name: /^Complete/ })).toBeVisible();
  });

  test("a revealed phone number is masked again after 60 seconds and has a Call link while shown", async ({ page, request }) => {
    const reference = await freshBooking(request, "Reveal Patient");
    await page.clock.install({ time: NOW });
    await openBookings(page);
    await find(page, reference);
    await opener(page, reference).click();
    const phone = drawer(page).getByTestId("phone");
    await expect(phone).toHaveAttribute("data-revealed", "false");
    await drawer(page).getByRole("button", { name: "Reveal" }).click();
    await expect(phone).toHaveAttribute("data-revealed", "true");
    await expect(phone).toHaveText(/^\d{4} \d{7}$/);
    await expect(drawer(page).getByRole("link", { name: "Call" })).toHaveAttribute("href", /^tel:\+923\d{9}$/);
    await page.clock.runFor(59_000);
    await expect(phone).toHaveAttribute("data-revealed", "true");
    await page.clock.runFor(2_000);
    await expect(phone).toHaveAttribute("data-revealed", "false");
    await expect(drawer(page).getByRole("link", { name: "Call" })).toHaveCount(0);
  });

  test("a change made from a stale view is refused with a calm message and the booking is refreshed", async ({ page, request, baseURL }) => {
    const reference = await freshBooking(request, "Stale Patient");
    await openBookings(page);
    await find(page, reference);
    await opener(page, reference).click();
    await expect(drawer(page)).toContainText(`Booking ${reference}`);

    // Somebody else moves the booking first (another session, same server).
    const other = await request.post(`/api/admin/bookings/${reference}/status`, {
      headers: { origin: baseURL!, cookie: "__Host-cc_session=cs_e2e-admin", "x-csrf-token": "csrf-cs_e2e-admin", "content-type": "application/json" },
      data: { to: "arrived", expectedVersion: 1 },
    });
    expect(other.status()).toBe(200);

    await drawer(page).getByRole("button", { name: "Cancel booking" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel booking" }).click();
    await expect(drawer(page).getByRole("alert").filter({ hasText: "changed by someone else" })).toBeVisible();
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Arrived");
    await expect(drawer(page).getByRole("button", { name: "Mark completed" })).toBeVisible();
  });

  test("the drawer traps focus, closes with Escape and gives focus back", async ({ page, request }) => {
    const reference = await freshBooking(request, "Focus Patient");
    await openBookings(page);
    await find(page, reference);
    const trigger = opener(page, reference);
    await trigger.focus();
    await trigger.click();
    await expect(drawer(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a refresh every 30 seconds updates the list without closing the drawer or moving focus", async ({ page, request }) => {
    const reference = await freshBooking(request, "Live Patient");
    await page.clock.install({ time: NOW });
    await openBookings(page);
    await find(page, reference);
    await opener(page, reference).click();
    await expect(drawer(page)).toBeVisible();
    const close = drawer(page).getByRole("button", { name: "Close" });
    await close.focus();
    const searches: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/admin/bookings/search")) searches.push(r.url());
    });
    await page.clock.runFor(30_500);
    await expect.poll(() => searches.length).toBeGreaterThan(0);
    await expect(drawer(page)).toBeVisible();
    await expect(close).toBeFocused();
  });

  test("the address keeps only non-personal filters, never the search text", async ({ page, request }) => {
    const reference = await freshBooking(request, "Private Patient");
    await openBookings(page);
    await find(page, reference);
    await page.getByRole("button", { name: /^Arrived/ }).first().waitFor({ state: "attached" });
    await page.locator('[role="group"][aria-label="Status"]:visible').getByRole("button", { name: /^Confirmed/ }).click();
    await expect(page).toHaveURL(/[?&]status=confirmed/);
    expect(page.url()).not.toContain(reference.slice(-6));
    expect(page.url()).not.toMatch(/[?&]q=/);
  });

  test("has no accessibility violations with the drawer open", async ({ page, request }) => {
    const reference = await freshBooking(request, "Axe Patient");
    await openBookings(page);
    await find(page, reference);
    await opener(page, reference).click();
    await expect(drawer(page)).toContainText(`Booking ${reference}`);
    await expect(drawer(page).getByText("Not given").first().or(drawer(page).locator(".dl"))).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
});

test.describe("demo", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("a change shows at once, is only in the browser, and is gone after a reload", async ({ page }) => {
    const statusCalls: string[] = [];
    page.on("request", (r) => {
      if (/\/status(\/undo)?$/.test(r.url())) statusCalls.push(r.url());
    });
    await openBookings(page);
    await expect(page.getByTestId("bookings-summary")).toContainText("bookings · clinic time (Karachi)");
    // Narrow to confirmed bookings, then take the first.
    await page.locator('[role="group"][aria-label="Status"]:visible').getByRole("button", { name: /^Confirmed/ }).click();
    const row = page.locator("tr[data-ref]:visible, .bcard[data-ref]:visible").first();
    await expect(row.locator('.pill[data-status="confirmed"]')).toBeVisible();
    const reference = (await row.getAttribute("data-ref"))!;
    await opener(page, reference).click();
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Confirmed");
    await expect(drawer(page)).toContainText("Demo: changes stay in this browser");
    await changeStatus(page, "Mark arrived");
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Arrived");
    await expect(toast(page)).toContainText(/Marked .+ as arrived\./);
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Confirmed");
    await changeStatus(page, "Mark arrived");
    await page.keyboard.press("Escape");
    // With the Confirmed filter on, the row leaves the list as soon as it is Arrived; look it up by reference.
    await page.locator('[role="group"][aria-label="Status"]:visible').getByRole("button", { name: /^All/ }).click();
    await find(page, reference);
    await expect(page.locator(`[data-ref="${reference}"]:visible .pill`).first()).toHaveText("Arrived");
    expect(statusCalls).toEqual([]);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await find(page, reference);
    await expect(page.locator(`[data-ref="${reference}"]:visible .pill`).first()).toHaveText("Confirmed");
  });

  test("the patient name in the table and the whole card open the drawer, and phone numbers are sample numbers", async ({ page }) => {
    await openBookings(page);
    const first = page.locator("tr[data-ref] .pt-open:visible, button.bcard[data-ref]:visible").first();
    await first.click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page)).toContainText("Sample patient");
    await drawer(page).getByRole("button", { name: "Reveal" }).click();
    await expect(drawer(page).getByTestId("phone")).toHaveText(/^0300 0000\d{3}$|^\d{4} \d{7}$/);
  });
});
