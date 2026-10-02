import { expect, test, type Page } from "@playwright/test";
import { NOTICE } from "./helpers";

/** The links of the primary navigation that are currently on screen (menu opened first on phones). */
async function visibleNav(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    return page.getByRole("navigation", { name: "Mobile" });
  }
  return page.getByRole("navigation", { name: "Primary" });
}

test.describe("links", () => {
  test("every internal link on Home resolves to a real page, never a not-found page", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("a[href^='/']")
      .evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.getAttribute("href") ?? ""))]);
    expect(hrefs.length).toBeGreaterThanOrEqual(25);

    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), `${href} should return 200`).toBe(200);
      // Check the page's own h1, not the raw text: every page's data payload also carries the
      // not-found component, so "Page not found" appears in all of them.
      const h1 = (await response.text()).match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1] ?? "";
      expect(h1, `${href} should render a real heading`).not.toBe("");
      expect(h1, `${href} should not render the not-found page`).not.toBe("Page not found");
    }
  });

  test("an unknown URL returns 404 and shows the friendly page inside the site layout", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.getByText(NOTICE).first()).toBeVisible();
  });

  test("the 404 page is rendered by the server, so it works without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText(NOTICE).first()).toBeVisible();
    await context.close();
  });

  test("an unknown doctor or department slug is a 404 too, not an empty Coming soon page", async ({ request }) => {
    expect((await request.get("/doctors/not-a-doctor")).status()).toBe(404);
    expect((await request.get("/departments/not-a-department")).status()).toBe(404);
    expect((await request.get("/a/b/c")).status()).toBe(404);
  });

  test("a Coming soon page keeps the layout and a way back Home", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "Coming soon" })).toBeVisible();
    await expect(page).toHaveTitle(/About — Coming soon/);
    await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL("/");
  });

  for (const [path, label] of [
    ["/", "Home"],
    ["/doctors", "Doctors"],
    ["/doctors/dr-imran-qureshi", "Doctors"],
    ["/health-tips/staying-hydrated", "Health Tips"],
  ] as const) {
    test(`marks exactly one navigation link as the current page on ${path}`, async ({ page, isMobile }) => {
      await page.goto(path);
      const nav = await visibleNav(page, isMobile);
      const current = nav.locator("a[aria-current='page']");
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(label);
    });
  }

  test("a page outside the navigation marks no link as current", async ({ page, isMobile }) => {
    await page.goto("/privacy");
    const nav = await visibleNav(page, isMobile);
    await expect(nav.locator("a[aria-current='page']")).toHaveCount(0);
  });
});
