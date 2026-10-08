import { expect, test, type Locator, type Page } from "@playwright/test";

import { signIn } from "./admin-helpers";
import { expectNoClipping } from "./helpers/clipping";

// The phone experience (Feature 006, US5): bottom navigation, booking cards, the sticky filters, the drawer as a
// bottom sheet, 44 px targets and no sideways scroll. Runs on the phone project only.

test.beforeEach(async ({ isMobile }) => {
  test.skip(!isMobile, "phone layout only");
});

const NAV_TARGET = 44;
const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

async function expectTarget(locator: Locator, label: string, min = NAV_TARGET) {
  const box = await locator.boundingBox();
  expect(box, `${label} is on screen`).not.toBeNull();
  expect(box!.height, `${label}: height`).toBeGreaterThanOrEqual(min);
  expect(box!.width, `${label}: width`).toBeGreaterThanOrEqual(min);
}

test.describe("bottom navigation", () => {
  test("a receptionist has four items, an admin six, each at least 44 px, the current one marked", async ({ page, context, baseURL }) => {
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    for (const link of await nav.getByRole("link").all()) await expectTarget(link, `nav "${await link.innerText()}"`);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

    await context.clearCookies();
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/bookings");
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
  });

  test("is fixed to the bottom of the screen and the side bar is hidden", async ({ page, context, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/bookings");
    const nav = await page.getByRole("navigation", { name: "Main" }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(nav!.y + nav!.height)).toBe(viewport.height);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = await page.getByRole("navigation", { name: "Main" }).boundingBox();
    expect(Math.round(after!.y + after!.height)).toBe(viewport.height);
    await expect(page.locator("aside.side")).toBeHidden();
  });
});

test.describe("the top bar", () => {
  test("has the clinic, a theme button and Sign out, within reach and not clipped", async ({ page, context, baseURL }) => {
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin");
    const bar = page.locator("header.m-top");
    await expect(bar.getByRole("button", { name: /^Theme: / })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expectTarget(bar.getByRole("button", { name: /^Theme: / }), "theme button", 36);
    await expectTarget(bar.getByRole("button", { name: "Sign out" }), "sign out", 36);
    await expectNoClipping(page, "phone top bar");
  });
});

test.describe("bookings on a phone", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("each booking is a card that is one button of at least 44 px", async ({ page }) => {
    await page.goto("/admin/bookings");
    await page.waitForLoadState("networkidle");
    const cards = page.locator("button.bcard");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);
    await expectTarget(cards.first(), "booking card", NAV_TARGET);
    await expect(page.locator("table.bk")).toBeHidden();
  });

  test("the search and the status chips stay in view while the list scrolls", async ({ page }) => {
    await page.goto("/admin/bookings");
    await page.waitForLoadState("networkidle");
    const filters = page.locator(".m-filters");
    const before = await filters.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForFunction(() => window.scrollY > 500);
    const after = await filters.boundingBox();
    const bar = await page.locator("header.m-top").boundingBox();
    expect(after!.y).toBeGreaterThanOrEqual(bar!.height - 2); // under the top bar, not scrolled away
    expect(after!.y).toBeLessThan(bar!.height + 10);
    expect(before!.y).toBeGreaterThan(after!.y);
    await expect(filters.getByRole("searchbox")).toBeVisible();
    await expectTarget(filters.getByRole("button", { name: /^Filters/ }), "filters button", 40);
  });

  test("a booking opens as a bottom sheet with 44 px actions", async ({ page }) => {
    await page.goto("/admin/bookings");
    await page.waitForLoadState("networkidle");
    await page.locator("button.bcard").first().click();
    await expect(drawer(page)).toBeVisible();
    const box = await drawer(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.width)).toBe(viewport.width);
    expect(Math.round(box!.y + box!.height)).toBe(viewport.height); // sits on the bottom edge
    expect(box!.height).toBeLessThanOrEqual(viewport.height * 0.9);
    for (const button of await drawer(page).locator(".dr-foot .btn").all()) await expectTarget(button, "drawer action", 44);
    await expectNoClipping(page, "bottom sheet");
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
  });
});

test.describe("no sideways scroll", () => {
  for (const [name, path] of [
    ["Overview", "/admin"],
    ["Bookings", "/admin/bookings"],
    ["Staff", "/admin/staff"],
    ["Sign in", "/admin/login"],
  ] as const) {
    test(`${name} fits the screen`, async ({ page, context, baseURL }) => {
      if (path !== "/admin/login") await signIn(context, "demo", baseURL!);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expectNoClipping(page, name);
    });
  }
});
