import { expect, test } from "@playwright/test";
import { privacyContent, termsContent } from "../../src/data/legalContent";
import { NOTICE } from "./helpers";

for (const [path, content] of [
  ["/privacy", privacyContent],
  ["/terms", termsContent],
] as const) {
  test.describe(`${content.title} page`, () => {
    test("shows the title, last-updated date, demo notice and a heading for every required topic", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: content.title })).toBeVisible();
      await expect(page.getByText("Last updated 2 Oct 2026")).toBeVisible();
      await expect(page.getByRole("main").getByText("Portfolio demo, not legal advice")).toBeVisible();
      await expect(page.getByText(/not legal advice/).first()).toBeVisible();
      for (const section of content.sections) {
        await expect(page.getByRole("heading", { level: 2, name: section.heading, exact: true })).toBeVisible();
      }
      await expect(page.getByText(NOTICE)).toHaveCount(2);
      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
      await expect(crumbs.getByText(content.title)).toHaveAttribute("aria-current", "page");
    });

    test("the contents links scroll to their sections", async ({ page }) => {
      await page.goto(path);
      const contents = page.getByRole("navigation", { name: `${content.title} contents` });
      await expect(contents.getByRole("link")).toHaveCount(content.sections.length);
      const last = content.sections.at(-1)!;
      await contents.getByRole("link", { name: last.heading, exact: true }).click();
      expect(new URL(page.url()).hash).toBe(`#${last.id}`);
      await expect(page.getByRole("heading", { level: 2, name: last.heading, exact: true })).toBeInViewport();
    });

    test("works without JavaScript", async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(`${path}#${content.sections[1]!.id}`);
      await expect(page.getByRole("heading", { level: 1, name: content.title })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: content.sections[1]!.heading, exact: true })).toBeInViewport();
      await context.close();
    });
  });
}

test("Privacy states that the demo collects no personal data and sets no tracking cookies", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText(/collects no personal data/)).toBeVisible();
  await expect(page.getByText(/sets no tracking cookies/).first()).toBeVisible();
  await expect(page.getByText("a patient sees only their own data", { exact: false })).toBeVisible();
});

test("every footer and legal link to Privacy and Terms opens a real page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});
