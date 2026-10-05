import { expect, type Page } from "@playwright/test";

import { setMode } from "../mock-api";
import { test, API_BASE } from "./fixtures";

// The booking backend going down must never break the page: the visitor sees a friendly message, and
// everything works again once it is back. /__log proves each call really reached the mock API.

type BookingLogEntry = { method: string; path: string; mode: string };

async function bookingLog(): Promise<BookingLogEntry[]> {
  const res = await fetch(`${API_BASE}/__log`);
  return ((await res.json()) as { booking?: BookingLogEntry[] }).booking ?? [];
}

async function pickDoctor(page: Page): Promise<void> {
  await page.getByRole("button", { name: /General Medicine/ }).click();
  await page.getByRole("button", { name: "Select Dr. Omar Sheikh" }).click();
}

test("slots down: the page says so, and Retry loads the times once the backend is back", async ({ page }) => {
  await page.goto("/book-appointment");
  await setMode(API_BASE, "booking-down");
  await pickDoctor(page);

  const unavailable = page.getByText("Online booking is temporarily unavailable. Please call the clinic.");
  await expect(unavailable).toBeVisible();
  await expect(page.getByRole("link", { name: /^Call / })).toBeVisible();
  expect((await bookingLog()).some((entry) => entry.path.endsWith("/slots") && entry.mode === "booking-down")).toBe(true);

  await setMode(API_BASE, "ok");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(unavailable).toBeHidden();
  await expect(page.locator('input[name="date"]:not([disabled])').first()).toBeAttached();
  expect((await bookingLog()).some((entry) => entry.path.endsWith("/slots") && entry.mode === "ok")).toBe(true);
});

test("a booking sent while the backend is down gets the safe-retry message and then works", async ({ page }) => {
  await page.goto("/book-appointment");
  await pickDoctor(page);
  await page.locator('input[name="date"]:not([disabled])').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Ali Khan");
  await page.getByLabel("Mobile number").fill("0300 1234567");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();

  await setMode(API_BASE, "booking-down");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "We couldn't confirm your booking yet" });
  await expect(alert).toContainText("It's safe to try again; you won't be booked twice.");
  await expect(page.getByLabel("Full name")).toHaveValue("Ali Khan");
  expect((await bookingLog()).some((entry) => entry.method === "POST" && entry.path === "/appointments" && entry.mode === "booking-down")).toBe(true);

  await setMode(API_BASE, "ok");
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  expect((await bookingLog()).some((entry) => entry.method === "POST" && entry.mode === "ok")).toBe(true);
});
