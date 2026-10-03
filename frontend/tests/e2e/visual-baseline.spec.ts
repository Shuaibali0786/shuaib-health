import { expect, test } from "@playwright/test";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { labTests } from "../fixtures/catalog/labTests";
import { scrollThrough } from "./helpers";

/**
 * Feature 004 visual baseline: proves "no visual change" when pages move from
 * static data to the catalog API. Runs on both projects (mobile = Pixel 7,
 * desktop = 1280x800). Slugs come from src/data for now.
 */
const PATHS: string[] = [
  "/",
  "/about",
  "/contact",
  "/book-appointment",
  "/departments",
  ...departments.map((department) => `/departments/${department.slug}`),
  "/doctors",
  ...doctors.map((doctor) => `/doctors/${doctor.slug}`),
  "/lab-tests",
  ...labTests.slice(0, 3).map((test) => `/lab-tests/${test.slug}`),
  "/health-packages",
  "/faq",
  "/health-tips",
  "/privacy",
  "/terms",
];

test.describe("visual baseline", () => {
  test.use({ reducedMotion: "reduce" });

  for (const path of PATHS) {
    test(`${path} matches the baseline`, async ({ page }) => {
      await page.goto(path);
      await scrollThrough(page);
      await expect(page).toHaveScreenshot({ fullPage: true, animations: "disabled" });
    });
  }
});
