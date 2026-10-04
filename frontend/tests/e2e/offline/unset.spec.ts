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

// Needs the neutral identity (no sample clinic values, no phone UI) from the identity-from-data
// phase (T062, T064). Until then the bundled sample clinic still fills in the phone numbers.
test.fixme("shows a neutral identity with no tel: links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("a[href^='tel:']")).toHaveCount(0);
});
