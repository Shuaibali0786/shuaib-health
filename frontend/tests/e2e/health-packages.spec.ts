import { expect, test, type Page } from "@playwright/test";
import { healthPackages } from "../../src/data/healthPackages";
import { NOTICE } from "./helpers";

const cards = (page: Page) => page.getByRole("article");
const number = (text: string | null) => Number((text ?? "").replace(/[^\d]/g, ""));

/** The value shown next to a row label inside a package card. */
async function row(card: ReturnType<typeof cards>, label: string): Promise<string | null> {
  return card.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]").textContent();
}

test.describe("health packages page", () => {
  test("shows the five packages with who they are for, preparation, home collection and a sample price label", async ({ page }) => {
    await page.goto("/health-packages");
    await expect(page.getByRole("heading", { level: 1, name: "Health packages" })).toBeVisible();
    await expect(page.getByText("All packages and prices are samples for the demo, in PKR.")).toBeVisible();
    await expect(cards(page)).toHaveCount(5);
    for (const name of ["Basic Health Check", "Diabetes Care", "Heart Check", "Women's Health", "Senior Citizen"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(cards(page).getByText("Sample price", { exact: true })).toHaveCount(5);
    await expect(cards(page).getByText("Preparation", { exact: true })).toHaveCount(5);
    await expect(cards(page).getByText("Home collection", { exact: true })).toHaveCount(5);
    await expect(cards(page).first()).toContainText("Adults who want a general look");
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("shows the breadcrumb Home > Health Packages", async ({ page }) => {
    await page.goto("/health-packages");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumbs.getByText("Health Packages")).toHaveAttribute("aria-current", "page");
  });

  test("each package shows the sum, the price and the difference, with no percentages or promotional words", async ({ page }) => {
    await page.goto("/health-packages");
    for (const pkg of healthPackages) {
      const card = cards(page).filter({ has: page.getByRole("heading", { level: 2, name: pkg.name, exact: true }) });
      await expect(card.locator("dt", { hasText: "Sum of individual tests" })).toBeVisible();
      await expect(card.locator("dt", { hasText: "Package price" })).toBeVisible();
      await expect(card.locator("dt", { hasText: "Difference" })).toBeVisible();
      const sum = number(await row(card, "Sum of individual tests"));
      const price = number(await row(card, "Package price"));
      const difference = number(await row(card, "Difference"));
      expect(price, pkg.slug).toBe(pkg.packagePricePkr);
      expect(price).toBeLessThanOrEqual(sum);
      expect(difference).toBe(sum - price);
    }
    const text = (await page.getByRole("main").innerText()).toLowerCase();
    expect(text).not.toMatch(/%|\b(discount|offer|deal|best value|cheap|bargain)\b/);
  });

  test("every included test link opens its test page, and the shown sum equals the prices on those pages", async ({ page, request }) => {
    await page.goto("/health-packages");
    for (const pkg of healthPackages) {
      const card = cards(page).filter({ has: page.getByRole("heading", { level: 2, name: pkg.name, exact: true }) });
      const links = card.locator("ul a");
      await expect(links).toHaveCount(pkg.testSlugs.length);
      const hrefs = await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
      expect(hrefs).toEqual(pkg.testSlugs.map((slug) => `/lab-tests/${slug}`));

      let total = 0;
      for (const href of hrefs) {
        const response = await request.get(href);
        expect(response.status(), href).toBe(200);
        const html = await response.text();
        const match = html.match(/PKR\s*([\d,]+)/);
        expect(match, `price on ${href}`).not.toBeNull();
        total += number(match![1] ?? null);
      }
      expect(number(await row(card, "Sum of individual tests")), pkg.slug).toBe(total);
    }
  });

  test("a test link in a package card goes to the test page with its breadcrumb", async ({ page }) => {
    await page.goto("/health-packages");
    await page.getByRole("link", { name: "HbA1c" }).first().click();
    await expect(page).toHaveURL(/\/lab-tests\/hba1c$/);
    await expect(page.getByRole("heading", { level: 1, name: "HbA1c" })).toBeVisible();
  });

  test("test pages list the packages that include them, and omit the block when there are none", async ({ page }) => {
    await page.goto("/lab-tests/hba1c");
    const block = page.getByRole("heading", { level: 2, name: "Included in packages" });
    await expect(block).toBeVisible();
    const list = block.locator("xpath=following-sibling::ul[1]");
    await expect(list.getByRole("link")).toHaveText(["Diabetes Care", "Senior Citizen"]);
    await expect(list.getByRole("link").first()).toHaveAttribute("href", "/health-packages");

    await page.goto("/lab-tests/blood-group-rh");
    await expect(page.getByRole("heading", { level: 1, name: "Blood Group & Rh Factor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Included in packages" })).toHaveCount(0);
  });

  test("works without JavaScript and makes no request to another site", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    const external: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    page.on("request", (request) => {
      if (!request.url().startsWith("data:") && new URL(request.url()).origin !== origin) external.push(request.url());
    });
    await page.goto("/health-packages");
    await expect(cards(page)).toHaveCount(5);
    expect(external).toEqual([]);
    await context.close();
  });
});
