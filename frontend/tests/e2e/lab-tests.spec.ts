import { expect, test, type Page } from "@playwright/test";
import { labTestCategories, labTests } from "../../src/data/labTests";
import { NOTICE } from "./helpers";

const cards = (page: Page) => page.getByRole("article");

/** Opens the catalog and waits until the filter island has taken over from the server-rendered fallback. */
async function openLabTests(page: Page) {
  await page.goto("/lab-tests");
  await page.locator("[data-filters-ready]").waitFor();
}

test.describe("lab test catalog", () => {
  test("shows every sample test with its price labelled as a sample price", async ({ page }) => {
    await page.goto("/lab-tests");
    await expect(page.getByRole("heading", { level: 1, name: "Lab tests" })).toBeVisible();
    await expect(page.getByText("All prices are sample prices for the demo, in PKR.")).toBeVisible();
    await expect(cards(page)).toHaveCount(labTests.length);
    await expect(cards(page).getByText("Sample price", { exact: true })).toHaveCount(labTests.length);
    const cbc = cards(page).filter({ hasText: "Complete Blood Count (CBC)" });
    await expect(cbc).toContainText("Also known as: CBC, Complete blood picture, CBP");
    await expect(cbc).toContainText(/PKR 800\s*Sample price/);
    await expect(cbc).toContainText("Blood");
    await expect(cbc).toContainText("Same day");
    await expect(cbc).toContainText("No preparation needed");
    await expect(cbc).toContainText("Home collection");
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("shows the breadcrumb Home > Lab Tests", async ({ page }) => {
    await page.goto("/lab-tests");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumbs.getByText("Lab Tests")).toHaveAttribute("aria-current", "page");
  });

  for (const [term, expected] of [
    ["sugar", 3],
    ["HbA1c", 1],
    ["cbc", 1],
  ] as const) {
    test(`searching "${term}" finds ${expected} test(s)`, async ({ page }) => {
      await openLabTests(page);
      await page.getByLabel("Search tests").fill(term);
      await expect(cards(page)).toHaveCount(expected);
      await expect(page).toHaveURL(new RegExp(`\\?q=${term}$`));
    });
  }

  test("every category chip filters to exactly its tests", async ({ page }) => {
    await openLabTests(page);
    for (const category of labTestCategories) {
      const count = labTests.filter((candidate) => candidate.categoryId === category.id).length;
      const chip = page.getByRole("button", { name: `${category.name} (${count})` });
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(cards(page)).toHaveCount(count);
      await expect(page.getByRole("status")).toContainText(`Showing ${count} of ${labTests.length} lab tests`);
      await expect(page).toHaveURL(new RegExp(`\\?category=${category.slug}$`));
    }
    await page.getByRole("button", { name: `All (${labTests.length})` }).click();
    await expect(cards(page)).toHaveCount(labTests.length);
  });

  test("keeps the filter in the URL across a reload", async ({ page }) => {
    await openLabTests(page);
    await page.getByRole("button", { name: /^Thyroid \(/ }).click();
    await page.reload();
    await page.locator("[data-filters-ready]").waitFor();
    await expect(page.getByRole("button", { name: /^Thyroid \(/ })).toHaveAttribute("aria-pressed", "true");
    await expect(cards(page)).toHaveCount(labTests.filter((candidate) => candidate.categoryId === "cat-thyroid").length);
  });

  test("shows the empty state, and Clear filters brings every test back", async ({ page }) => {
    await openLabTests(page);
    await page.getByLabel("Search tests").fill("zzzz");
    await expect(page.getByText("No lab tests match your search")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(labTests.length);
    await expect(page).toHaveURL(/\/lab-tests$/);
  });

  test("shows the full catalog with the controls even without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/lab-tests");
    await expect(cards(page)).toHaveCount(labTests.length);
    await expect(page.getByLabel("Search tests")).toBeVisible();
    await context.close();
  });

  test("makes no request to any other site while filtering", async ({ page, baseURL }) => {
    const external: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    page.on("request", (request) => {
      if (!request.url().startsWith("data:") && new URL(request.url()).origin !== origin) external.push(request.url());
    });
    await openLabTests(page);
    await page.getByRole("button", { name: /^Diabetes \(/ }).click();
    await page.getByLabel("Search tests").fill("hba1c");
    await expect(cards(page)).toHaveCount(1);
    expect(external).toEqual([]);
  });
});

test.describe("lab test page", () => {
  test("shows every field, the sample price label and the breadcrumb", async ({ page }) => {
    await page.goto("/lab-tests/hba1c");
    await expect(page.getByRole("heading", { level: 1, name: "HbA1c" })).toBeVisible();
    await expect(page.getByText("Sample test", { exact: true })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: "Also known as:" })).toContainText("Glycated hemoglobin, A1c, Average sugar test");
    const facts = page.getByRole("main").locator("dl");
    await expect(facts.locator("dt")).toHaveText(["Category", "Price", "Sample type", "Report time", "Preparation", "Home collection"]);
    await expect(facts).toContainText("Diabetes");
    await expect(facts).toContainText("PKR 1,500");
    await expect(facts.getByText("Sample price", { exact: true })).toBeVisible();
    await expect(facts).toContainText("Blood");
    await expect(facts).toContainText("Same day");
    await expect(facts).toContainText("No preparation needed");
    await expect(page.getByText("Follow your doctor's instructions about preparation.")).toBeVisible();
    await expect(page.getByText(/does not explain results/)).toBeVisible();

    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Lab Tests" })).toHaveAttribute("href", "/lab-tests");
    await expect(crumbs.getByText("HbA1c")).toHaveAttribute("aria-current", "page");

    await expect(page.getByRole("main").getByRole("link", { name: "General Medicine", exact: true })).toHaveAttribute("href", "/departments/general-medicine");
    await expect(page.getByRole("main").getByRole("link", { name: "Pathology Lab", exact: true })).toHaveAttribute("href", "/departments/pathology-lab");
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("a card on the catalog opens its test page", async ({ page }) => {
    await openLabTests(page);
    await page.getByRole("link", { name: "Complete Blood Count (CBC)" }).click();
    await expect(page).toHaveURL(/\/lab-tests\/complete-blood-count$/);
    await expect(page.getByRole("heading", { level: 1, name: "Complete Blood Count (CBC)" })).toBeVisible();
  });

  test("every sample test has a page that opens", async ({ request }) => {
    for (const { slug } of labTests) {
      const response = await request.get(`/lab-tests/${slug}`);
      expect(response.status(), slug).toBe(200);
    }
  });

  test("an unknown test shows the not-found page with the site layout", async ({ page }) => {
    const response = await page.goto("/lab-tests/not-a-test");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });
});
