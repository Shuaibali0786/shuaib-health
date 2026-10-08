import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { signIn } from "./admin-helpers";

// The theme (Feature 006, US5): choosing Night persists across reload and navigation without a flash, and Auto
// follows the device live. The buttons are the sidebar's segmented control on wide screens and a cycle button on phones.

const NIGHT = "rgb(6, 26, 51)"; // navy-950
const LIGHT = "rgb(244, 247, 250)";
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Picks a theme with whichever control is on screen: Light / Night / Auto, or the phone's cycle button. */
async function choose(page: Page, theme: "Light" | "Night" | "Auto") {
  const segmented = page.getByRole("group", { name: "Theme" }).getByRole("button", { name: theme, exact: true });
  if (await segmented.isVisible()) {
    await segmented.click();
    return;
  }
  const order = ["Light", "Night", "Auto"];
  const cycle = page.locator("header.m-top").getByRole("button", { name: /^Theme: / });
  for (let presses = 0; presses < 3; presses += 1) {
    if ((await cycle.getAttribute("aria-label"))?.startsWith(`Theme: ${theme}.`)) return;
    await cycle.click();
  }
  throw new Error(`could not reach ${theme} (${order.join(", ")})`);
}

async function themeCookie(context: BrowserContext): Promise<string | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === "cc_theme")?.value;
}

test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

test("Night applies at once, is remembered in the cc_theme cookie and survives a reload and navigation", async ({ page, context }) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(LIGHT);

  await choose(page, "Night");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe(NIGHT);
  expect(await themeCookie(context)).toBe("dark");
  const cookie = (await context.cookies()).find((c) => c.name === "cc_theme")!;
  expect(cookie.path).toBe("/admin");
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(364 * 86400);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe(NIGHT);

  await page.goto("/admin/bookings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/admin/staff");
  expect(await background(page)).toBe(NIGHT);
});

test("there is no flash: the server already puts Night on <html> and the first paint is dark", async ({ page, context, request }) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await choose(page, "Night");
  const cookies = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const html = await (await request.get("/admin", { headers: { cookie: cookies } })).text();
  expect(html).toMatch(/<html[^>]*data-theme="dark"[^>]*data-theme-pref="dark"/);

  // The theme on <html> and the page colour at the very first moment the document exists, before any script has run.
  await page.addInitScript(() => {
    const record = () => {
      const root = document.documentElement;
      if (!root) return false;
      (window as unknown as { __first?: { theme?: string } }).__first = { theme: root.dataset.theme };
      return true;
    };
    if (!record()) {
      const observer = new MutationObserver(() => {
        if (record()) observer.disconnect();
      });
      observer.observe(document, { childList: true });
    }
  });
  await page.goto("/admin/bookings");
  expect(await page.evaluate(() => (window as unknown as { __first?: { theme?: string } }).__first?.theme)).toBe("dark");
  expect(await background(page)).toBe(NIGHT);
});

test("choosing Light again goes back, and the cookie follows", async ({ page, context }) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await choose(page, "Night");
  await choose(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await themeCookie(context)).toBe("light");
  expect(await background(page)).toBe(LIGHT);
});

test("Auto follows the device while the page is open", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await choose(page, "Auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "system");
  expect(await themeCookie(context)).toBe("system");
  expect(await background(page)).toBe(LIGHT);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).toBe(NIGHT);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => background(page)).toBe(LIGHT);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-pref", "system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).toBe(NIGHT);
});

test("the control shows the chosen theme", async ({ page, isMobile }) => {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await choose(page, "Night");
  if (isMobile) {
    await expect(page.locator("header.m-top").getByRole("button", { name: "Theme: Night. Switch to Auto." })).toBeVisible();
  } else {
    await expect(page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
  }
});
