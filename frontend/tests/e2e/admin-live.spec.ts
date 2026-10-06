import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { signIn } from "./admin-helpers";

// The live parts of the Overview (Feature 006, US3, FR-040 to FR-042) against the mock API, with the clock
// paused at Mon 5 Oct 2026, 11:20:45 in the clinic: the header clock, the greeting, the moving "Now" line,
// the 30 s refresh, the "New booking" notifications, a hidden tab, the demo's simulated booking and reduced motion.

const MOCK = "http://127.0.0.1:4010";
const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now);

async function openOverview(page: Page, path = "/admin") {
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
  // The Bookings screen learns what is already booked from this answer; a booking made before it would not be new.
  const baseline = path === "/admin" ? null : page.waitForResponse((r) => r.url().includes("/api/admin/overview"));
  await page.goto(path);
  if (baseline) await baseline;
  else await expect(page.getByTestId("status-mix")).toBeVisible();
}

async function newBooking(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`${MOCK}/__admin/new-booking`, { data: { name, minutesFromNow: 40 } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { reference: string }).reference;
}

const clock = (page: Page) => page.locator(".statusbar .clock time");
const updated = (page: Page) => page.locator(".live-pill .updated");
const toasts = (page: Page) => page.getByTestId("new-booking-toast");
const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

test.describe("the clock and the greeting", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("the header clock shows the clinic time and moves by the second", async ({ page }) => {
    await openOverview(page);
    await expect(clock(page)).toHaveText("11:20:45 AM");
    await page.clock.runFor(1000);
    await expect(clock(page)).toHaveText("11:20:46 AM");
  });

  test("the greeting follows the clinic hour: morning at 11:20, afternoon at 13:05, evening at 19:40", async ({ page }) => {
    await openOverview(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Good morning");
    await page.clock.fastForward((1 * 60 + 45) * 60_000 - 45_000 + 1000); // to 13:05
    await expect(heading).toHaveText("Good afternoon");
    await page.clock.fastForward((6 * 60 + 35) * 60_000); // to 19:40
    await expect(heading).toHaveText("Good evening");
  });

  test("the Now line moves to the next minute after 60 seconds", async ({ page, isMobile }) => {
    await openOverview(page);
    const marker = isMobile ? page.getByTestId("now-row").locator("visible=true").first() : page.getByTestId("now-marker");
    if (isMobile) await expect(marker).toHaveText("Now 11:20");
    else await expect(marker).toHaveAttribute("data-label", "Now 11:20");
    await page.clock.runFor(60_000);
    if (isMobile) await expect(marker).toHaveText("Now 11:21");
    else await expect(marker).toHaveAttribute("data-label", "Now 11:21");
  });
});

test.describe("the 30 second refresh", () => {
  // They share one mock server and make bookings that every open page is told about, so they take turns.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "receptionist", baseURL!));

  test("the updated label counts up and resets when the data is refreshed", async ({ page }) => {
    await openOverview(page);
    await expect(updated(page)).toContainText("just now");
    await page.clock.runFor(20_000);
    await expect(updated(page)).toContainText("20 s ago");
    await page.clock.runFor(10_500);
    await expect(updated(page)).toContainText("just now", { timeout: 10_000 });
  });

  test("a booking made on the server appears as a notification after the next refresh, and View booking opens it", async ({ page, request }) => {
    await openOverview(page);
    const reference = await newBooking(request, "Mehwish Hanif");
    await page.clock.runFor(30_500);
    const toast = toasts(page).filter({ hasText: "Mehwish H." });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText("New booking");
    await expect(toast).toContainText("booked just now");
    await toast.getByRole("button", { name: "View booking" }).click();
    await expect(drawer(page)).toContainText(`Booking ${reference}`);
    await expect(toast).toHaveCount(0);
  });

  test("the same notification is shown on the Bookings screen", async ({ page, request }) => {
    await openOverview(page, "/admin/bookings");
    await newBooking(request, "Nimra Zahid");
    await page.clock.runFor(30_500);
    const toast = toasts(page).filter({ hasText: "Nimra Z." });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await toast.getByRole("button", { name: "View booking" }).click();
    await expect(drawer(page)).toContainText("Nimra Zahid");
  });

  test("a notification hides itself after 8 seconds unless it is hovered", async ({ page, request, isMobile }) => {
    await openOverview(page);
    await newBooking(request, "Hira Qadir");
    await page.clock.runFor(30_500);
    const toast = toasts(page).filter({ hasText: "Hira Q." });
    await expect(toast).toBeVisible({ timeout: 10_000 });
    if (!isMobile) {
      await toast.hover();
      await page.clock.runFor(20_000);
      await expect(toast).toBeVisible();
      await page.mouse.move(5, 5);
    }
    await page.clock.runFor(8_500);
    await expect(toast).toHaveCount(0);
  });

  test("a hidden tab makes no requests", async ({ page }) => {
    await openOverview(page);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/admin/overview")) requests.push(request.url());
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(120_000);
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
    // Back in view: it refreshes at once.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });
});

test.describe("the demo", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("simulates an online booking after 50 seconds: a notification, a chip or row more and the count up by one", async ({ page }) => {
    await openOverview(page);
    const before = fixture.overview.kpis.appointments.value as number;
    await expect(page.locator('[data-kpi="appointments"]').getByTestId("count-final")).toHaveText(String(before));
    await page.clock.runFor(49_000);
    await expect(toasts(page)).toHaveCount(0);
    await page.clock.runFor(2_000);
    const toast = toasts(page).first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("New booking");
    await expect(page.locator('[data-kpi="appointments"]').getByTestId("count-final")).toHaveText(String(before + 1));
    // The new booking is in the agenda and can be opened; it was never sent to the server.
    const reference = await toast.getAttribute("data-ref");
    expect(reference).toMatch(/^D[0-9A-HJKMNP-TV-Z]{9}$/);
    await expect(page.locator(`[data-ref="${reference}"]`).locator("visible=true").first()).toBeAttached();
    await toast.getByRole("button", { name: "View booking" }).click();
    await expect(drawer(page)).toContainText("Online booking");
  });
});

test.describe("reduced motion", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("shows the numbers at once and has no pulse, glow or slide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openOverview(page);
    // No count-up: the number on screen is already the final one, with no time having passed.
    await expect(page.locator('[data-kpi="appointments"] [data-testid="count-visual"]')).toHaveText(String(fixture.overview.kpis.appointments.value));
    await expect(page.locator(".live-dot")).toBeVisible();
    const pulse = await page.locator(".live-dot").evaluate((el) => getComputedStyle(el, "::after").animationName);
    expect(pulse).toBe("none");
    await page.clock.runFor(51_000);
    const toast = toasts(page).first();
    await expect(toast).toBeVisible();
    expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await toast.locator(".nb-progress").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});
