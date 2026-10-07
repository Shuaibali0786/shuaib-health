import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, runUntilNewBookingToast, setTheme, signIn, wcagViolations } from "./admin-helpers";
import { expectNoClipping } from "./helpers/clipping";

// Accessibility of every Command Centre screen that exists (Feature 006, US5, FR-045): axe with the WCAG 2.2 AA tags
// and the clipping check, each in Light and Night, at the width of the project this runs in (390 / 1280 / 1366 /
// 1440 px), plus keyboard-only journeys and reduced motion. The clock is paused at 11:20:45 Karachi.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now);
type Item = { reference: string; localTime: string; status: string; patientNameMasked: string; allowedNext: string[] };
const items: Item[] = fixture.overview.agenda.flatMap((row: { items: Item[] }) => row.items);
const arrivable = items.find((item) => item.allowedNext.includes("arrived"))!;

const THEMES = ["light", "dark"] as const;

async function pauseAtNow(page: Page) {
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
}

/** Axe and the clipping check on what is on screen now. Axe uses timers of its own, so the clock runs for it. */
async function expectAccessible(page: Page, label: string) {
  await page.clock.runFor(1200).catch(() => {}); // finish the count-up
  await page.clock.resume().catch(() => {});
  await expectNoClipping(page, label);
  expect(await wcagViolations(page), label).toEqual([]);
}

const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });
const opener = (page: Page, reference: string) => page.locator(`tr[data-ref="${reference}"] .pt-open:visible, button.bcard[data-ref="${reference}"]:visible`).first();

async function waitForHydration(page: Page) {
  await page.waitForLoadState("networkidle");
}

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search reference or patient name" }).and(page.locator(":visible"));

/** Finds a booking the way a person does: by its reference in the search box (the list is paged). */
async function find(page: Page, reference: string) {
  await searchBox(page).fill(reference.slice(-6));
  await expect(page.locator(`[data-ref="${reference}"]:visible`).first()).toBeVisible();
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await setTheme(context, theme, baseURL!);
    });

    test("the sign-in page", async ({ page }) => {
      await page.goto("/admin/login");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expectAccessible(page, `login, ${theme}`);
    });

    test.describe("the demo", () => {
      test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

      test("Overview", async ({ page }) => {
        await pauseAtNow(page);
        await page.goto("/admin");
        await revealStreamedContent(page);
        await expect(page.getByTestId("status-mix")).toBeVisible();
        await expectAccessible(page, `Overview, ${theme}`);
      });

      test("Overview as a list", async ({ page, isMobile }) => {
        test.skip(isMobile, "a phone always shows the list");
        await pauseAtNow(page);
        await page.goto("/admin");
        await revealStreamedContent(page);
        await page.getByRole("button", { name: "List" }).click();
        await expect(page.getByTestId("agenda-list").first()).toBeVisible();
        await expectAccessible(page, `Overview list, ${theme}`);
      });

      test("a chip's tooltip", async ({ page, isMobile }) => {
        test.skip(isMobile, "the timeline and its tooltip are on wide screens");
        await pauseAtNow(page);
        await page.goto("/admin");
        await revealStreamedContent(page);
        await expect(page.getByTestId("status-mix")).toBeVisible();
        await page.locator(".tl-b.confirmed").first().focus();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await expectAccessible(page, `chip tooltip, ${theme}`);
      });

      test("the new-booking toast", async ({ page }) => {
        await pauseAtNow(page);
        await page.goto("/admin");
        await revealStreamedContent(page);
        await expect(page.getByTestId("status-mix")).toBeVisible();
        await runUntilNewBookingToast(page);
        await expectAccessible(page, `new-booking toast, ${theme}`);
      });

      test("Bookings: the list, the drawer, the confirmation and the undo toast", async ({ page }) => {
        await page.goto("/admin/bookings");
        await waitForHydration(page);
        await expect(page.getByTestId("bookings-summary")).toBeVisible();
        await expectAccessible(page, `Bookings, ${theme}`);

        await find(page, arrivable.reference);
        await opener(page, arrivable.reference).click();
        await expect(drawer(page)).toContainText(`Booking ${arrivable.reference}`);
        await expectAccessible(page, `Bookings drawer, ${theme}`);

        await drawer(page).getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await expectAccessible(page, `Bookings confirmation, ${theme}`);

        await page.getByRole("alertdialog").getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByTestId("undo-toast")).toBeVisible();
        await expectAccessible(page, `Bookings undo toast, ${theme}`);
      });

      test("Staff", async ({ page }) => {
        await page.goto("/admin/staff");
        await expect(page.getByRole("heading", { name: "People with access" })).toBeVisible();
        await expectAccessible(page, `Staff, ${theme}`);
      });
    });

    test("Staff, as an admin who can add people", async ({ page, context, baseURL }) => {
      await signIn(context, "admin", baseURL!);
      await page.goto("/admin/staff");
      await expect(page.getByRole("heading", { name: "Add a staff member" })).toBeVisible();
      await expectAccessible(page, `Staff (admin), ${theme}`);
    });

    test("the password page", async ({ page, context, baseURL }) => {
      await signIn(context, "admin", baseURL!);
      await page.goto("/admin/account/password");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectAccessible(page, `password, ${theme}`);
    });
  });
}

// ----- keyboard only -------------------------------------------------------------------------------

/** Presses Tab until `target` has focus (at most `limit` presses), so a journey never uses the mouse. */
async function tabTo(page: Page, target: Locator, limit = 80) {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${target}`);
}

test.describe("keyboard only", () => {
  test("demo open, find a booking, mark it arrived, undo", async ({ page, isMobile }) => {
    test.skip(isMobile, "the keyboard journey is for a desktop with a keyboard");
    await page.goto("/admin/login");
    await waitForHydration(page);
    await tabTo(page, page.getByRole("button", { name: "View Demo Dashboard" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("status-mix")).toBeVisible();

    await tabTo(page, page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible")).getByRole("link", { name: "Bookings" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/bookings/);
    await waitForHydration(page);

    const search = page.getByRole("searchbox", { name: "Search reference or patient name" }).and(page.locator(":visible"));
    await tabTo(page, search);
    await page.keyboard.type(arrivable.reference.slice(-6));
    const opens = page.locator(`tr[data-ref="${arrivable.reference}"] .pt-open`);
    await expect(opens).toBeVisible();
    await tabTo(page, opens);
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toContainText(`Booking ${arrivable.reference}`);

    await tabTo(page, drawer(page).getByRole("button", { name: "Mark arrived" }));
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("button", { name: "Not now" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm.getByRole("button", { name: "Mark arrived" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Arrived");

    const undo = page.getByTestId("undo-toast").getByRole("button", { name: "Undo" });
    await tabTo(page, undo);
    await page.keyboard.press("Enter");
    await expect(drawer(page).locator(".dr-badges .pill")).toHaveText("Confirmed");
  });

  test("chip, drawer, Escape", async ({ page, context, baseURL, isMobile }) => {
    test.skip(isMobile, "the timeline is on wide screens");
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await waitForHydration(page);
    const chip = page.locator(`.tl-b[data-ref="${arrivable.reference}"]`);
    await tabTo(page, chip, 200);
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toContainText(`Booking ${arrivable.reference}`);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(chip).toBeFocused();
  });

  test("the agenda view and the theme can be switched from the keyboard", async ({ page, context, baseURL, isMobile }) => {
    test.skip(isMobile, "the switches are on wide screens (the phone has its own theme button)");
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await waitForHydration(page);
    await tabTo(page, page.getByRole("button", { name: "List" }));
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await tabTo(page, page.getByRole("button", { name: "Night" }), 200);
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

// ----- reduced motion ------------------------------------------------------------------------------

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  for (const path of ["/admin", "/admin/bookings"]) {
    test(`nothing animates on ${path}`, async ({ page, context, baseURL }) => {
      await signIn(context, "demo", baseURL!);
      await page.goto(path);
      await waitForHydration(page);
      await page.waitForTimeout(400);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming().iterations ?? 1) === Infinity).map((a) => `${(a as CSSAnimation).animationName ?? a.id}`));
      expect(running).toEqual([]);
    });
  }
});
