import { expect, type Page } from "@playwright/test";

import { setMode } from "../mock-api";
import { test, API_BASE } from "./fixtures";

// A double click, or a retry after the answer was lost, must never book twice: the browser keeps one
// Idempotency-Key per attempt and the mock API (like the real one) replays it.

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

type BookingLogEntry = { method: string; path: string; idempotencyKey?: string | null };

async function bookingPosts(): Promise<BookingLogEntry[]> {
  const res = await fetch(`${API_BASE}/__log`);
  const log = (await res.json()) as { booking?: BookingLogEntry[] };
  return (log.booking ?? []).filter((entry) => entry.method === "POST" && entry.path === "/appointments");
}

test("a double click on Confirm sends one request and gives one confirmation", async ({ page }) => {
  await toDetails(page);
  await page.getByRole("button", { name: "Confirm booking" }).dblclick();

  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  expect(await bookingPosts()).toHaveLength(1);
});

test("after a timeout, Try again reuses the key and books once", async ({ page }) => {
  await toDetails(page);
  await setMode(API_BASE, "booking-slow");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "We couldn't confirm your booking yet" });
  await expect(alert).toContainText("It's safe to try again; you won't be booked twice.", { timeout: 40_000 });
  await expect(page.getByLabel("Full name")).toHaveValue("Ali Khan");

  await setMode(API_BASE, "ok");
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);

  const posts = await bookingPosts();
  expect(posts).toHaveLength(2);
  expect(posts[0]?.idempotencyKey).toBeTruthy();
  expect(posts[1]?.idempotencyKey).toBe(posts[0]?.idempotencyKey);
});
