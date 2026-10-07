import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, runUntilNewBookingToast, setTheme, signIn } from "./admin-helpers";
import { expectNoClipping } from "./helpers/clipping";

// Visual baselines of the Command Centre (Feature 006, US5, T128, SC-010): the mock API's demo day, the clock paused at
// 11:20:45 Karachi, animations off. Each shot runs the clipping check first. The projects supply the widths
// (390 / 1280 / 1366 / 1440 px); every shot is taken in Light and in Night. The images are reviewed against
// `specs/006-clinic-command-centre/design-preview/screenshots/` before they are approved and committed.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now);
type Item = { reference: string; allowedNext: string[] };
const arrivable = (fixture.overview.agenda.flatMap((row: { items: Item[] }) => row.items) as Item[]).find((item) => item.allowedNext.includes("arrived"))!;

const THEMES = ["light", "dark"] as const;

async function pauseAtNow(page: Page) {
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
}

/** The page is settled (fonts, the KPI count-up) and nothing is clipped. */
async function settle(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(1200);
  await expectNoClipping(page, label);
}

const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

/** Finds a booking the way a person does: by its reference in the search box (the list is paged). */
async function find(page: Page, reference: string) {
  await page.getByRole("searchbox", { name: "Search reference or patient name" }).and(page.locator(":visible")).fill(reference.slice(-6));
  await page.clock.runFor(400); // the search waits 300 ms after the last key, and the clock is paused
  await expect(page.locator(`[data-ref="${reference}"]:visible`).first()).toBeVisible();
}

for (const theme of THEMES) {
  test.describe(`${theme}`, () => {
    test.use({ reducedMotion: "no-preference" });

    test.beforeEach(async ({ context, baseURL }) => {
      await signIn(context, "demo", baseURL!);
      await setTheme(context, theme, baseURL!);
    });

    test("Overview", async ({ page, isMobile }) => {
      await pauseAtNow(page);
      await page.goto("/admin");
      await revealStreamedContent(page);
      await expect(page.getByTestId("status-mix")).toBeVisible();
      await settle(page, `Overview ${theme}`);
      await expect(page).toHaveScreenshot(`overview-${theme}.png`, { fullPage: !isMobile, animations: "disabled" });
    });

    test("Bookings", async ({ page, isMobile }) => {
      await pauseAtNow(page);
      await page.goto("/admin/bookings");
      await revealStreamedContent(page);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("bookings-summary")).toBeVisible();
      await settle(page, `Bookings ${theme}`);
      await expect(page).toHaveScreenshot(`bookings-${theme}.png`, { fullPage: !isMobile, animations: "disabled" });
    });

    test("the Bookings drawer", async ({ page }) => {
      await pauseAtNow(page);
      await page.goto("/admin/bookings");
      await revealStreamedContent(page);
      await page.waitForLoadState("networkidle");
      await find(page, arrivable.reference);
      await page.locator(`tr[data-ref="${arrivable.reference}"] .pt-open:visible, button.bcard[data-ref="${arrivable.reference}"]:visible`).first().click();
      await expect(drawer(page)).toContainText(`Booking ${arrivable.reference}`);
      await expect(drawer(page).getByTestId("phone")).toBeVisible();
      await settle(page, `Bookings drawer ${theme}`);
      await expect(page).toHaveScreenshot(`bookings-drawer-${theme}.png`, { animations: "disabled" });
    });

    test("the confirmation dialog", async ({ page }) => {
      await pauseAtNow(page);
      await page.goto("/admin/bookings");
      await revealStreamedContent(page);
      await page.waitForLoadState("networkidle");
      await find(page, arrivable.reference);
      await page.locator(`tr[data-ref="${arrivable.reference}"] .pt-open:visible, button.bcard[data-ref="${arrivable.reference}"]:visible`).first().click();
      await drawer(page).getByRole("button", { name: "Mark arrived" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await settle(page, `Bookings confirmation ${theme}`);
      await expect(page).toHaveScreenshot(`bookings-confirm-${theme}.png`, { animations: "disabled" });
    });

    test("a chip's tooltip", async ({ page, isMobile }) => {
      test.skip(isMobile, "the timeline and its tooltip are on wide screens");
      await pauseAtNow(page);
      await page.goto("/admin");
      await revealStreamedContent(page);
      await expect(page.getByTestId("status-mix")).toBeVisible();
      await settle(page, `Overview ${theme}`);
      await page.locator(".tl-b.confirmed").first().focus();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await expect(page).toHaveScreenshot(`overview-chip-${theme}.png`, { animations: "disabled" });
    });

    test("the new-booking toast", async ({ page }) => {
      await pauseAtNow(page);
      await page.goto("/admin");
      await revealStreamedContent(page);
      await expect(page.getByTestId("status-mix")).toBeVisible();
      await settle(page, `Overview ${theme}`);
      await runUntilNewBookingToast(page);
      await page.clock.runFor(500); // the slide-in is done (the clock is paused, so it is still)
      // The simulated booking is chosen by the demo's seeded generator, so a few pixels may differ between machines.
      await expect(page).toHaveScreenshot(`overview-new-booking-${theme}.png`, { animations: "disabled", maxDiffPixels: 400 });
    });
  });
}
