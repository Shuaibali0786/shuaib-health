import { expect, test } from "@playwright/test";
import { aboutContent } from "../../src/data/aboutContent";
import { NOTICE } from "./helpers";

const BANNED =
  /\b(ratings?|reviews?|testimonials?|awards?|award-winning|certified|certifications?|accredited|accreditations?|patients served|years of experience|best in|number one|top-rated)\b/i;

test.describe("about page", () => {
  test("states plainly that it is a portfolio demo and shows mission, values, photos and the visit steps", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "About Shuaib Health" })).toBeVisible();
    await expect(page.getByText(/portfolio demo\. It is not a real clinic/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Our mission" })).toBeVisible();
    await expect(page.getByText(aboutContent.mission)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "What we value" })).toBeVisible();
    for (const value of aboutContent.values) await expect(page.getByRole("heading", { level: 3, name: value.title })).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("shows the breadcrumb Home > About", async ({ page }) => {
    await page.goto("/about");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumbs.getByText("About")).toHaveAttribute("aria-current", "page");
  });

  test("lists five numbered visit steps in order", async ({ page }) => {
    await page.goto("/about");
    const steps = page.getByRole("main").getByRole("list").filter({ hasText: "Step 1" }).getByRole("listitem");
    await expect(steps).toHaveCount(5);
    for (const [index, step] of aboutContent.visitSteps.entries()) {
      await expect(steps.nth(index)).toContainText(`Step ${index + 1}`);
      await expect(steps.nth(index)).toContainText(step.title);
    }
    await expect(page.getByRole("main").locator("ol", { hasText: "Step 1" })).toHaveCount(1);
  });

  test("every photo has an Illustrative caption", async ({ page }) => {
    await page.goto("/about");
    const figures = page.getByRole("main").locator("figure");
    await expect(figures).toHaveCount(aboutContent.facilityPhotos.length);
    for (const figure of await figures.all()) {
      await expect(figure.locator("img")).toHaveCount(1);
      await expect(figure.locator("figcaption")).toContainText(/^Illustrative image/);
    }
    await expect(page.getByRole("main").locator("img")).toHaveCount(aboutContent.facilityPhotos.length);
  });

  test("contains none of the banned claim words, and no invented numbers", async ({ page }) => {
    await page.goto("/about");
    const text = await page.getByRole("main").innerText();
    expect(text).not.toMatch(BANNED);
    expect(text).not.toMatch(/\d+\s*\+|\d[\d,]*\s*(years?|patients?|staff|branches)\b|\b(founded|established) (in|on)\b/i);
  });

  test("links to the doctors and the lab tests", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("main").getByRole("link", { name: "Find a doctor" }).click();
    await expect(page).toHaveURL(/\/doctors$/);
    await page.goto("/about");
    await expect(page.getByRole("main").getByRole("link", { name: "Browse lab tests" })).toHaveAttribute("href", "/lab-tests");
  });

  test("works without JavaScript and makes no request to another site", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    const external: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    page.on("request", (request) => {
      if (!request.url().startsWith("data:") && new URL(request.url()).origin !== origin) external.push(request.url());
    });
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 2, name: "How a visit works" })).toBeVisible();
    expect(external).toEqual([]);
    await context.close();
  });
});
