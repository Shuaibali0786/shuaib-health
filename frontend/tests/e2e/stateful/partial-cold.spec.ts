import { expect, test } from "@playwright/test";

// The cold server starts in "partial" mode (departments answer 500) with an empty data cache and no
// other spec touches it, so /departments is the first request ever: there is no last good data.
test.use({ baseURL: "http://localhost:3301" });
test.setTimeout(180_000);

test("a cold server shows the message for the failing resource only", async ({ page }) => {
  const response = await page.goto("/departments");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("main").getByText(/temporarily unavailable/i)).toBeVisible();

  const doctors = await page.goto("/doctors");
  expect(doctors?.status()).toBe(200);
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("main").getByText(/temporarily unavailable/i)).toHaveCount(0);
});
