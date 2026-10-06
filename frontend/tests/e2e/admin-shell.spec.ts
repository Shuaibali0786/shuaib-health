import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { setTheme, signIn } from "./admin-helpers";

// The Command Centre shell (Phase 2): navigation by role, the live status line, theme without a flash,
// nothing clipped at the four admin widths, and no axe violations in either theme.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const ADMIN_NAV = ["Overview", "Bookings", "Doctors", "Insights", "Activity", "Staff"];
const RECEPTIONIST_NAV = ["Overview", "Bookings", "Doctors", "Insights"];

/** The main navigation that is on screen: the side bar on desktop, the bottom bar on phones. */
const visibleNav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible"));

test.describe("navigation follows the role", () => {
  test("an admin sees every screen, with the Admin badges", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin");
    const links = visibleNav(page).getByRole("link");
    await expect(links).toHaveCount(ADMIN_NAV.length);
    for (const label of ADMIN_NAV) await expect(visibleNav(page).getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
    await expect(visibleNav(page).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  test("a receptionist sees no Activity and no Staff", async ({ page, context, baseURL }) => {
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin");
    await expect(visibleNav(page).getByRole("link")).toHaveCount(RECEPTIONIST_NAV.length);
    await expect(visibleNav(page).getByRole("link", { name: /Activity/ })).toHaveCount(0);
    await expect(visibleNav(page).getByRole("link", { name: /Staff/ })).toHaveCount(0);
  });

  test("the demo viewer sees every screen (its data is synthetic)", async ({ page, context, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    await expect(visibleNav(page).getByRole("link")).toHaveCount(ADMIN_NAV.length);
  });
});

test.describe("shell", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "admin", baseURL!));

  test("shows the clinic name, the signed-in person and the author credit", async ({ page, isMobile }) => {
    await page.goto("/admin");
    await expect(page.locator(".brand-sub:visible").first()).toHaveText("Command Centre");
    if (!isMobile) {
      await expect(page.getByText("Sample Admin")).toBeVisible();
      await expect(page.getByText("Admin", { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Designed & built by Shuaib Ali" })).toHaveAttribute("href", "https://github.com/Shuaibali0786");
    await expect(page.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeVisible();
  });

  test("has one main landmark, a skip link first, and an h1", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });

  test("the live status line shows the clinic clock ticking and a Live pill", async ({ page }) => {
    await page.goto("/admin");
    const clock = page.locator(".clock time");
    await expect(clock).toHaveText(/^\d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    await expect(page.locator(".clock .tz")).toHaveText("· Karachi");
    const first = await clock.textContent();
    await expect.poll(async () => clock.textContent(), { timeout: 5000 }).not.toBe(first);
    const pill = page.locator(".live-pill");
    await expect(pill).toContainText("Live");
    await expect(pill).toContainText("just now");
    await expect(page.locator(".statusbar .eyebrow")).toHaveText(/^Command Centre · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
  });

  test("the greeting follows the clinic hour", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), Sample$/);
  });

  test("the navy side column reaches the bottom of the window, also at the end of a page", async ({ page, isMobile }) => {
    test.skip(isMobile, "the side column only exists from 901 px");
    await page.goto("/admin/staff");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const viewport = page.viewportSize()!;
    const shot = await page.screenshot({ clip: { x: 0, y: viewport.height - 48, width: 200, height: 48 } });
    // Decode in the page: every pixel of the strip must be the dark navy of the column, never white.
    const brightest = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      let max = 0;
      for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i]!, data[i + 1]!, data[i + 2]!);
      return max;
    }, shot.toString("base64"));
    expect(brightest).toBeLessThan(120);
  });

  test("the demo card says Read-only · Admin view under the name", async ({ page, context, baseURL, isMobile }) => {
    test.skip(isMobile, "the account card is in the side column");
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin");
    const card = page.locator(".side .who");
    await expect(card.locator("b")).toHaveText("Demo viewer");
    await expect(card.locator("span")).toHaveText("Read-only · Admin view");
  });

  test("signed out, /admin goes to the sign-in page and keeps the path", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  });
});

test.describe("theme", () => {
  test("is light by default, and dark when the cc_theme cookie says so, already in the first HTML", async ({ request, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const light = await (await request.get("/admin", { headers: { cookie } })).text();
    expect(light).toMatch(/<html[^>]*data-theme="light"[^>]*data-theme-pref="light"/);
    const dark = await (await request.get("/admin", { headers: { cookie: `${cookie}; cc_theme=dark` } })).text();
    expect(dark).toMatch(/<html[^>]*data-theme="dark"[^>]*data-theme-pref="dark"/);
    const system = await (await request.get("/admin", { headers: { cookie: `${cookie}; cc_theme=system` } })).text();
    expect(system).toMatch(/data-theme-pref="system"/);
  });

  test("an unknown cookie value falls back to light", async ({ request, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const html = await (await request.get("/admin", { headers: { cookie: `${cookie}; cc_theme=neon` } })).text();
    expect(html).toMatch(/data-theme="light"/);
  });

  test("the navy night theme paints the page background", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await setTheme(context, "dark", baseURL!);
    await page.goto("/admin");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(6, 26, 51)"); // navy-950
  });

  test("Auto follows the device", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await setTheme(context, "system", baseURL!);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/admin");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(6, 26, 51)");
    await page.emulateMedia({ colorScheme: "light" });
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 247, 250)");
  });
});

test.describe("layout and accessibility", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "admin", baseURL!));

  test("nothing scrolls sideways or is clipped at this width", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".side, .main, .content, .statusbar, .clock, .live-pill, .foot")]
        .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
        .map((el) => el.className),
    );
    expect(clipped).toEqual([]);
  });

  test("laptop widths use the compact spacing (content padding 28 px)", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("admin-laptop"), "laptop rules apply at 901 to 1439 px");
    await page.goto("/admin");
    expect(await page.locator(".content").evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("28px");
  });

  test("desktop width uses the full spacing (content padding 40 px)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "admin-desktop", "1440 px and up");
    await page.goto("/admin");
    expect(await page.locator(".content").evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("40px");
  });

  test("phones use the bottom navigation and hide the side bar", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/admin");
    await expect(page.locator(".bottom-nav")).toBeVisible();
    await expect(page.locator(".side")).toBeHidden();
    const box = await page.getByRole("link", { name: "Bookings" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`has no axe violations in the ${theme} theme`, async ({ page, context, baseURL }) => {
      await setTheme(context, theme, baseURL!);
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id} (${v.impact}) on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
});
