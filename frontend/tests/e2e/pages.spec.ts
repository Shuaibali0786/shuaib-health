import { expect, test } from "@playwright/test";
import { getPageManifest } from "../../src/lib/pages";
import { fixtureCatalog } from "../fixtures/catalog";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { NOTICE } from "./helpers";

const manifest = getPageManifest(fixtureCatalog, siteConfig.fullTitle);

test.describe("every manifest page", () => {
  for (const entry of manifest) {
    test(`${entry.path}: status, one h1, notice, breadcrumb, title, canonical and Open Graph`, async ({ page }) => {
      const response = await page.goto(entry.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByText(NOTICE)).toHaveCount(2);

      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      if (entry.path === "/") await expect(crumbs).toHaveCount(0);
      else if (entry.path !== "/book-appointment") await expect(crumbs).toHaveCount(1);

      // The manifest title is unique (pages.test.ts), so the rendered title must contain it.
      const title = await page.title();
      expect(title).toContain(entry.title);

      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(new URL(canonical ?? "", "http://x").pathname).toBe(entry.path);
      await expect(page.locator("meta[property='og:title']")).toHaveCount(1);
      await expect(page.locator("meta[property='og:description']")).toHaveCount(1);
    });
  }

  test("pages that show sample data say so", async ({ page }) => {
    for (const path of ["/doctors", "/lab-tests", "/health-packages", "/health-tips", "/contact", "/about"]) {
      await page.goto(path);
      await expect(page.getByRole("main").getByText(/Sample|Illustrative/).first(), path).toBeVisible();
    }
  });
});
