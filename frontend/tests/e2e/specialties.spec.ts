// Feature 009: "Choose your specialty" demo presets (the e2e build runs with the demo on).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("specialty presets", () => {
  test("the index shows Multi-speciality and the switcher changes the whole clinic", async ({ page }) => {
    await page.goto("/demo/specialties");
    const nav = page.getByRole("navigation", { name: "Choose your specialty" });
    await expect(nav.getByRole("link", { name: "Multi-speciality" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Crescent Family Clinic").first()).toBeVisible();

    await nav.getByRole("link", { name: "Dental" }).click();
    await expect(page).toHaveURL(/\/demo\/specialties\/dental$/);
    await expect(page.locator("[data-preset]")).toHaveAttribute("data-preset", "dental");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gentle dentistry, booked in a minute");
    await expect(page.getByText("Pearl Dental Studio").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teeth whitening" })).toBeVisible();

    await page.getByRole("navigation", { name: "Choose your specialty" }).getByRole("link", { name: "Skin & Aesthetic" }).click();
    await expect(page.locator("[data-preset]")).toHaveAttribute("data-preset", "skin-aesthetic");
    await expect(page.getByText("Lumière Skin Clinic").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teeth whitening" })).toHaveCount(0);
  });

  test("each preset is labelled as a sample and offers the real booking and demo dashboard", async ({ page }) => {
    await page.goto("/demo/specialties/diagnostic-lab");
    await expect(page.getByText("Sample clinic", { exact: true })).toBeVisible();
    await expect(page.getByText("Sample profile")).toHaveCount(3);
    await expect(page.getByText("Preview", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Try the real booking" })).toHaveAttribute("href", "/book-appointment");
    await expect(page.locator("form[action='/admin/demo/start']").first()).toBeAttached();
    await expect(page.getByText("0300 1234567").first()).toBeVisible();
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  });

  test("an unknown preset is the normal 404", async ({ page }) => {
    const response = await page.goto("/demo/specialties/cardiac");
    expect(response?.status()).toBe(404);
  });

  for (const id of ["dental", "skin-aesthetic", "diagnostic-lab", "multi-speciality"]) {
    test(`${id}: no axe violations and no sideways scroll`, async ({ page }) => {
      await page.goto(`/demo/specialties/${id}`);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
