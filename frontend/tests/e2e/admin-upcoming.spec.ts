import { expect, test, type Page } from "@playwright/test";

import { signIn, wcagViolations } from "./admin-helpers";

// Upcoming bookings, New, the bell, Booked on and the Overview cards (Feature 012) against the mock API. The
// admin projects run in parallel against one mock server and the bell is per staff session, so tests that change
// what is "seen" use their own session; the others only read.

const visible = (page: Page) => page.locator(":visible");

test.describe("Upcoming", () => {
  test("lists every booking from tomorrow grouped by day, soonest first, with a count per day", async ({ page, context, baseURL, isMobile }) => {
    test.skip(isMobile, "the phone cards are covered below");
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/bookings?view=upcoming");
    await expect(page.getByRole("button", { name: "Upcoming" })).toHaveAttribute("aria-pressed", "true");
    const days = page.locator("table.bk tr.day-row");
    await expect(days.first()).toContainText("Tomorrow");
    await expect(days.first()).toContainText(/\d+ bookings?/);
    expect(await days.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("columnheader", { name: "Booked on" })).toBeVisible();
    // Dates do not repeat in the rows: the day heading carries them.
    await expect(page.locator("table.bk tbody tr[data-ref]").first()).toBeVisible();
  });

  test("on a phone the cards are grouped by day too", async ({ page, context, baseURL, isMobile }) => {
    test.skip(!isMobile, "phones only");
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/bookings?view=upcoming");
    await expect(page.locator(".bcards .day-head h3").first()).toContainText("Tomorrow");
    await expect(page.locator(".bcard .booked-ago").first()).toContainText("Booked");
  });

  test("a typed search finds a booking on another day, whatever date is selected, and says so", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/bookings?view=upcoming");
    const reference = await page.locator("[data-ref]:visible").first().getAttribute("data-ref");
    await page.goto("/admin/bookings"); // today
    await page.waitForLoadState("networkidle");
    await page.getByRole("searchbox", { name: "Search reference or patient name" }).and(visible(page)).fill(reference!.slice(2, 8));
    await expect(page.locator(`[data-ref="${reference}"]:visible`).first()).toBeVisible();
    await expect(page.getByText("Searching all dates").and(visible(page)).first()).toBeVisible();
  });

  test("Recently booked narrows to what was made in the last 24 hours", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/bookings?booked=24h&sort=recent");
    await expect(page.getByRole("button", { name: "Last 24 hours" }).and(visible(page))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-ref]:visible").first()).toBeVisible();
  });
});

test.describe("New and the bell", () => {
  test("a booking is New until opened, the bell counts down, and Mark all seen clears the rest", async ({ page, context, baseURL }, testInfo) => {
    // The bell is per staff session and the projects share one mock server, so one project owns this session.
    test.skip(testInfo.project.name !== "admin-desktop", "changes the receptionist session's seen state");
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin/bookings?view=upcoming");
    const bell = page.getByRole("button", { name: /^New bookings: \d+$/ }).and(visible(page));
    await expect(bell).toBeVisible();
    const before = Number((await bell.getAttribute("aria-label"))!.match(/\d+/)![0]);
    expect(before).toBeGreaterThan(1);

    const fresh = page.locator('[data-new="true"]:visible').first();
    await expect(fresh).toBeVisible();
    await fresh.getByRole("button", { name: /^(?!View booking|Mark)/ }).first().click().catch(async () => fresh.click());
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: `New bookings: ${before - 1}` }).and(visible(page))).toBeVisible();

    await page.getByRole("button", { name: "Mark all seen" }).first().click();
    await expect(page.getByRole("button", { name: "New bookings: none" }).and(visible(page))).toBeVisible();
    await expect(page.locator('[data-new="true"]:visible')).toHaveCount(0);
  });

  test("the bell lists the newest with when they were booked and opens one", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin");
    await page.getByRole("button", { name: /^New bookings/ }).and(visible(page)).click();
    const panel = page.getByRole("region", { name: "New bookings" });
    await expect(panel.locator("li").first()).toContainText("Booked");
    await panel.locator("li button").first().click();
    await expect(page).toHaveURL(/\/admin\/bookings/);
    await expect(page.getByRole("dialog").first()).toBeVisible();
  });
});

test.describe("Overview cards", () => {
  test("show Today, Tomorrow, Next 7 days, New since last visit and Cancelled this week, each a link", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin");
    for (const id of ["today", "tomorrow", "next7", "new", "cancelled"]) await expect(page.locator(`[data-count="${id}"]`)).toBeVisible();
    await page.locator('[data-count="tomorrow"]').click();
    await expect(page).toHaveURL(/\/admin\/bookings\?from=2026-10-06&to=2026-10-06/);
  });

  test("the new screens have no accessibility violations", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    for (const path of ["/admin", "/admin/bookings?view=upcoming"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await wcagViolations(page), path).toEqual([]);
    }
  });
});
