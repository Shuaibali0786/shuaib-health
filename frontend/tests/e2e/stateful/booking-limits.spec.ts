import { expect, type Page } from "@playwright/test";

import { setMode } from "../mock-api";
import { test, API_BASE } from "./fixtures";

// In `rate-limited` mode the API answers every booking POST with 429 + Retry-After: 60. The visitor
// gets the friendly message, a visible countdown, and a Confirm button that stays off.

async function toDetails(page: Page): Promise<void> {
  await page.goto("/book-appointment");
  await page.getByRole("button", { name: /General Medicine/ }).click();
  await page.getByRole("button", { name: "Select Dr. Omar Sheikh" }).click();
  await page.locator('input[name="date"]:not([disabled])').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
  await page.getByLabel("Full name").fill("Ali Khan");
  await page.getByLabel("Mobile number").fill("0300 1234567");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
}

test("when rate limited, the visitor sees the message and Confirm stays disabled", async ({ page }) => {
  await toDetails(page);
  await setMode(API_BASE, "rate-limited");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Too many attempts. Please try again later or call the clinic" })).toBeVisible();
  await expect(page.getByTestId("booking-cooldown")).toContainText(/You can try again in (60|59|58) seconds\./);
  await expect(page.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
  await expect(page.getByLabel("Full name")).toHaveValue("Ali Khan");
});
