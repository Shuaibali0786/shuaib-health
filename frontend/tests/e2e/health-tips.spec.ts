import { expect, test, type Page } from "@playwright/test";
import { healthTips } from "../../src/data/healthTips";
import { NOTICE } from "./helpers";

const cards = (page: Page) => page.getByRole("article");

/** Opens the list and waits until the filter island has taken over from the server-rendered fallback. */
async function openTips(page: Page) {
  await page.goto("/health-tips");
  await page.locator("[data-filters-ready]").waitFor();
}

test.describe("health tips list", () => {
  test("shows every article with its category, reading time and Sample label", async ({ page }) => {
    await page.goto("/health-tips");
    await expect(page.getByRole("heading", { level: 1, name: "Health tips" })).toBeVisible();
    await expect(page.getByText(/General information, not medical advice/).first()).toBeVisible();
    expect(healthTips.length).toBeGreaterThanOrEqual(6);
    await expect(cards(page)).toHaveCount(healthTips.length);
    await expect(cards(page).getByText("Sample", { exact: true })).toHaveCount(healthTips.length);
    await expect(cards(page).getByText(/\d min read/)).toHaveCount(healthTips.length);
    const walk = cards(page).filter({ hasText: "Adding a short daily walk" });
    await expect(walk).toContainText("Activity");
    await expect(walk.locator("img")).toHaveAttribute("alt", /walking along a tree-lined park path/);
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("shows the breadcrumb Home > Health Tips", async ({ page }) => {
    await page.goto("/health-tips");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumbs.getByText("Health Tips")).toHaveAttribute("aria-current", "page");
  });

  test("every category chip filters to exactly its articles, and the filter stays in the URL", async ({ page }) => {
    await openTips(page);
    const categories = [...new Set(healthTips.map((tip) => tip.category))];
    expect(categories).toHaveLength(5);
    for (const category of categories) {
      const count = healthTips.filter((tip) => tip.category === category).length;
      const chip = page.getByRole("button", { name: `${category} (${count})` });
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(cards(page)).toHaveCount(count);
      await expect(page.getByRole("status")).toContainText(`Showing ${count} of ${healthTips.length} articles`);
    }
    await page.reload();
    await page.locator("[data-filters-ready]").waitFor();
    await expect(page.getByRole("button", { name: /^Mental wellbeing \(/ })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole("button", { name: `All (${healthTips.length})` }).click();
    await expect(cards(page)).toHaveCount(healthTips.length);
  });

  test("shows all articles and the chips even without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/health-tips");
    await expect(cards(page)).toHaveCount(healthTips.length);
    await expect(page.getByRole("button", { name: /^Sleep \(/ })).toBeVisible();
    await context.close();
  });

  test("Home's latest three tips are unchanged and show no reading time", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby='tips-title']");
    const tips = section.locator("article");
    await expect(tips).toHaveCount(3);
    await expect(tips.nth(0)).toContainText("Small habits for staying hydrated");
    await expect(tips.nth(1)).toContainText("A calmer routine for better sleep");
    await expect(tips.nth(2)).toContainText("Building a balanced plate");
    await expect(section.getByText(/min read/)).toHaveCount(0);
  });
});

test.describe("health tip article", () => {
  for (const tip of healthTips) {
    test(`${tip.slug} shows its text, the medical note, related articles and the breadcrumb`, async ({ page }) => {
      await page.goto(`/health-tips/${tip.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: tip.title })).toBeVisible();
      await expect(page.getByText("Sample article", { exact: true })).toBeVisible();
      await expect(page.getByText(/\d min read/).first()).toBeVisible();
      await expect(page.getByRole("main").locator("time").first()).toHaveAttribute("datetime", tip.publishedAt);
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
      await expect(page.getByRole("complementary", { name: "Medical note" })).toContainText("General information, not medical advice.");
      await expect(page.getByRole("main").locator("img").first()).toHaveAttribute("alt", tip.image.alt);

      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.getByRole("link", { name: "Health Tips" })).toHaveAttribute("href", "/health-tips");
      await expect(crumbs.getByText(tip.title)).toHaveAttribute("aria-current", "page");

      const related = page.getByRole("region", { name: "Related articles" }).getByRole("article");
      const count = await related.count();
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(3);
      await expect(related.filter({ hasText: tip.title })).toHaveCount(0);
      await expect(page.getByText(NOTICE)).toHaveCount(2);
    });
  }

  test("a related article opens", async ({ page }) => {
    await page.goto("/health-tips/staying-hydrated");
    await page.getByRole("region", { name: "Related articles" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/health-tips\/balanced-plate$/);
    await expect(page.getByRole("heading", { level: 1, name: "Building a balanced plate" })).toBeVisible();
  });

  test("an unknown article shows the not-found page with the site layout", async ({ page }) => {
    const response = await page.goto("/health-tips/not-an-article");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });
});
