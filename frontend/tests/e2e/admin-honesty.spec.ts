import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./admin-helpers";

// Honesty on every Command Centre route (Feature 006, T150; constitution I): the portfolio disclaimer and the
// author credit everywhere, noindex everywhere, the demo ribbon on every demo screen and "Sample" cues on demo data.

const NOTICE = "Portfolio demo — not a real clinic, not medical advice.";
const CREDIT = { text: "Designed & built by Shuaib Ali", href: "https://github.com/Shuaibali0786" };
const SCREENS = ["/admin", "/admin/bookings", "/admin/doctors", "/admin/insights", "/admin/activity", "/admin/staff"];

async function expectDisclaimerCreditAndNoindex(page: Page, path: string): Promise<void> {
  await expect(page.getByText(NOTICE).first(), path).toBeVisible();
  await expect(page.getByRole("link", { name: CREDIT.text }).first(), path).toHaveAttribute("href", CREDIT.href);
  await expect(page.locator("meta[name='robots']"), path).toHaveAttribute("content", /noindex/);
}

test("the sign-in page carries the disclaimer, the credit and noindex", async ({ page }) => {
  expect((await page.goto("/admin/login"))?.status()).toBe(200);
  await expectDisclaimerCreditAndNoindex(page, "/admin/login");
});

test("every staff screen carries the disclaimer, the credit and noindex", async ({ page, context, baseURL }) => {
  await signIn(context, "admin", baseURL!);
  for (const path of [...SCREENS, "/admin/account/password"]) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expectDisclaimerCreditAndNoindex(page, path);
    // A signed-in staff member sees no demo ribbon.
    await expect(page.getByTestId("demo-ribbon"), path).toHaveCount(0);
  }
});

test("every demo screen carries the ribbon, the disclaimer, the credit and noindex", async ({ page, context, baseURL }) => {
  await signIn(context, "demo", baseURL!);
  for (const path of SCREENS) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expectDisclaimerCreditAndNoindex(page, path);
    const ribbon = page.getByTestId("demo-ribbon");
    await expect(ribbon, path).toBeVisible();
    await expect(ribbon, path).toContainText("All names and numbers are sample data.");
  }
});

test("demo bookings are labelled Sample: every row of the list and the booking drawer", async ({ page, context, baseURL, isMobile }) => {
  test.skip(isMobile, "phones show booking cards; the table and its drawer are the desktop list");
  await signIn(context, "demo", baseURL!);
  await page.goto("/admin/bookings");
  const rows = page.locator("table.bk tbody tr[data-ref]");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  await expect(rows.locator(".sample", { hasText: "Sample" })).toHaveCount(count);
  await rows.first().locator(".pt-open").click();
  await expect(page.getByText("Sample patient", { exact: true })).toBeVisible();
});
