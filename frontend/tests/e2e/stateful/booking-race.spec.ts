import { expect, type Locator, type Page } from "@playwright/test";

import { test, API_BASE } from "./fixtures";

// Two visitors pick the same slot. A confirms first; B's attempt hits the real store conflict in the
// mock API ("slot taken"), keeps the details already typed, picks an alternative and books it.

async function chooseFirstSlot(page: Page): Promise<void> {
  await page.goto("/book-appointment");
  await page.getByRole("button", { name: /General Medicine/ }).click();
  await page.getByRole("button", { name: "Select Dr. Omar Sheikh" }).click();
  await page.locator('input[name="date"]:not([disabled])').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
}

async function fillAndConfirm(page: Page, name: string, confirm = true): Promise<void> {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill("0300 1234567");
  await page.getByLabel(/Email/).fill("visitor@example.com");
  await page.getByLabel(/Reason/).fill("Checkup");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  if (confirm) await page.getByRole("button", { name: "Confirm booking" }).click();
}

type BookingLogEntry = { method: string; path: string; idempotencyKey?: string | null };

async function bookingPosts(): Promise<BookingLogEntry[]> {
  const res = await fetch(`${API_BASE}/__log`);
  const log = (await res.json()) as { booking?: BookingLogEntry[] };
  return (log.booking ?? []).filter((entry) => entry.method === "POST" && entry.path === "/appointments");
}

test("the second visitor to confirm a slot is told it was just taken, and can book another", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  await chooseFirstSlot(a);
  await b.goto(a.url()); // the same choices live in the URL
  await expect(b.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
  await expect(b.getByRole("button", { name: "Confirm booking" })).toBeVisible();

  await fillAndConfirm(a, "Ali Khan");
  await expect(a).toHaveURL(/\/book-appointment\/confirmed\//);

  await fillAndConfirm(b, "Bilal Raza");
  const alert: Locator = b.locator("div[role=alert]", { hasText: "just taken" });
  await expect(alert).toContainText("Sorry, this slot was just taken.");
  const choices = alert.getByRole("button").filter({ hasNotText: "See all times" });
  expect(await choices.count()).toBeGreaterThanOrEqual(1);
  expect(await choices.count()).toBeLessThanOrEqual(5);

  // B's details are still there.
  await expect(b.getByLabel("Full name")).toHaveValue("Bilal Raza");
  await expect(b.getByLabel("Mobile number")).toHaveValue("0300 1234567");
  await expect(b.getByLabel(/Email/)).toHaveValue("visitor@example.com");
  await expect(b.getByLabel(/Reason/)).toHaveValue("Checkup");

  await choices.first().click();
  await expect(alert).toHaveCount(0);
  await b.getByRole("button", { name: "Confirm booking" }).click();
  await expect(b).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);

  const posts = await bookingPosts();
  expect(posts).toHaveLength(3);
  const keys = posts.map((post) => post.idempotencyKey);
  expect(new Set(keys).size).toBe(3);
  expect(keys[2]).not.toBe(keys[1]);

  await contextA.close();
  await contextB.close();
});
