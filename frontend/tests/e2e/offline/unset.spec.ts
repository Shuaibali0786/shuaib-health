import { expect, test } from "@playwright/test";

import { ALL_PATHS, CREDIT, NOTICE } from "../helpers";

// Production build with CATALOG_API_URL and CLINIC_FALLBACK_JSON both unset (a fresh clone with no
// .env.local). The build must work and every page must render.

for (const path of ALL_PATHS) {
  test(`${path}: renders with the site chrome and the honesty text when nothing is configured`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), "status").toBe(200);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByText(NOTICE).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: CREDIT.text })).toHaveAttribute("href", CREDIT.href);
  });
}

test("catalog sections say they are unavailable", async ({ page }) => {
  await page.goto("/doctors");
  await expect(page.getByText(/temporarily unavailable/i).first()).toBeVisible();
});

// With nothing configured the site shows a neutral identity: no sample clinic values and no phone UI.
test("shows a neutral identity with no tel: links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("a[href^='tel:']")).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Clinic home" })).toBeVisible();
  // "Shuaib Health" is the platform credit's name ("Powered by Shuaib Health"), never the clinic's. Only that
  // one element, found by its test id, may carry it; the same words anywhere else on the page still fail.
  const NOT_THE_CREDIT = "*:not([data-testid='powered-by']):not([data-testid='powered-by'] *)";
  await expect(page.getByText("Shuaib Health").and(page.locator(NOT_THE_CREDIT))).toHaveCount(0);
  await expect(page.getByTestId("powered-by")).toHaveText("Powered by Shuaib Health");
  await expect(page.getByText("+92 21")).toHaveCount(0);
});

test("the Contact and Book Appointment pages show no phone link and no rules heading", async ({ page }) => {
  for (const path of ["/contact", "/book-appointment"]) {
    await page.goto(path);
    await expect(page.locator("a[href^='tel:']"), path).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Before your visit" }), path).toHaveCount(0);
  }
});

test("booking pages render a friendly state, without a phone link, when nothing is configured", async ({ page }) => {
  await page.goto("/book-appointment");
  await expect(page.getByRole("main").getByText("Online booking is temporarily unavailable. Please call the clinic.")).toBeVisible();
  await expect(page.getByText(NOTICE).first()).toBeVisible();

  const response = await page.goto("/book-appointment/confirmed/ABCDE-FGHJK");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "We can't show your booking right now" })).toBeVisible();
  await expect(page.getByText("ABCDE-FGHJK").first()).toBeVisible();
});
