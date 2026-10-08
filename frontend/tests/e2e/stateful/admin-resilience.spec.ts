import { expect, type BrowserContext, type Page } from "@playwright/test";

import { signIn } from "../admin-helpers";
import { setMode } from "../mock-api";
import { API_BASE, test } from "./fixtures";

// The Command Centre when its backend is down, slow or refuses (Feature 006, T151, NFR-002): the sign-in page and the
// demo entry stay calm, the Overview keeps its last data and backs off, a status change that times out is re-read and
// never sent twice, and the public booking flow is untouched by any of it. /__log proves each call reached the mock.

type AdminLogEntry = { method: string; path: string; mode: string };

async function adminLog(): Promise<AdminLogEntry[]> {
  const res = await fetch(`${API_BASE}/__log`);
  return ((await res.json()) as { admin?: AdminLogEntry[] }).admin ?? [];
}

const OVERVIEW_POLL = (entry: AdminLogEntry) => entry.method === "GET" && entry.path === "/admin/overview";

async function signInWithForm(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("admin@clinic.test");
  await page.getByLabel("Password").fill("Correct-Horse-9-Battery");
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The "View Demo Dashboard" button of the gold top bar on Home. */
async function startDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "View Demo Dashboard" }).first().click();
}

/** Books the first free slot with General Medicine, as a visitor would, and returns at the confirmation. */
async function bookAppointment(page: Page): Promise<void> {
  await page.goto("/book-appointment");
  await page.getByRole("button", { name: /General Medicine/ }).click();
  await page.getByRole("button", { name: "Select Dr. Omar Sheikh" }).click();
  await page.locator('input[name="date"]:not([disabled])').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Resilient Visitor");
  await page.getByLabel("Mobile number").fill("0300 1234567");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/, { timeout: 20_000 });
}

test.describe("sign-in page and demo entry", () => {
  test("backend down: the sign-in page loads and a sign-in gets a calm message", async ({ page }) => {
    await setMode(API_BASE, "admin-down");
    await signInWithForm(page);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("We could not reach the service. Check your connection and try again.");
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect((await adminLog()).some((e) => e.path === "/admin/auth/sign-in" && e.mode === "admin-down")).toBe(true);
  });

  test("backend down: View Demo Dashboard returns to the sign-in page with a calm message", async ({ page }) => {
    await setMode(API_BASE, "admin-down");
    await startDemo(page);
    await expect(page).toHaveURL(/\/admin\/login\?demo=unavailable$/);
    await expect(page.getByRole("status")).toHaveText("The demo is not available right now. Please try again shortly.");
    expect((await adminLog()).some((e) => e.path === "/admin/demo/start" && e.mode === "admin-down")).toBe(true);
  });

  test("backend slow: View Demo Dashboard gives up after its timeout with the same calm message", async ({ page }) => {
    test.slow(); // the demo entry waits 10 s for the backend
    await setMode(API_BASE, "admin-slow");
    await startDemo(page);
    await expect(page).toHaveURL(/\/admin\/login\?demo=unavailable$/, { timeout: 20_000 });
    await expect(page.getByRole("status")).toHaveText("The demo is not available right now. Please try again shortly.");
  });
});

test.describe("signed in", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context as BrowserContext, "receptionist", baseURL!));

  test("Overview polling: the last data stays, the pill says Retrying, it backs off to 60 s, then recovers", async ({ page }) => {
    await page.clock.install();
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const mix = page.getByTestId("status-mix");
    await expect(mix).toBeVisible();
    const before = await mix.textContent();
    const pill = page.locator(".live-pill");
    await expect(pill).toHaveAttribute("data-state", "live");

    await setMode(API_BASE, "admin-down");
    await page.clock.runFor(30_000); // first poll, fails
    await expect(pill).toHaveAttribute("data-state", "stale");
    await expect(pill).toContainText("Retrying");
    expect(await mix.textContent()).toBe(before); // the last good data stays on screen
    // A calm notice that says the numbers shown are the last ones, never a raw error.
    const notice = page.getByRole("alert").filter({ hasText: "We could not refresh the overview" });
    await expect(notice).toContainText("The last numbers are still shown. Please try again in a moment.");
    await expect(notice).not.toContainText(/50\d|error|failed/i);
    const failed = async () => (await adminLog()).filter((e) => OVERVIEW_POLL(e) && e.mode === "admin-down").length;
    await expect.poll(failed).toBe(1);

    await page.clock.runFor(30_000); // backed off: nothing yet
    await page.waitForTimeout(500);
    expect(await failed()).toBe(1);
    await page.clock.runFor(30_000); // 60 s after the failure: second try
    await expect.poll(failed).toBe(2);

    await setMode(API_BASE, "ok");
    await page.clock.runFor(120_000); // the next try (backed off to 120 s) succeeds
    await expect(pill).toHaveAttribute("data-state", "live");
    await expect(notice).toHaveCount(0);
    await expect(mix).toBeVisible();
  });

  test("a status change that times out says so calmly, re-reads the list and is never sent again", async ({ page, request, isMobile }) => {
    test.skip(isMobile, "the quick action is part of the desktop table");
    test.slow(); // the website waits 10 s for the status change
    const created = await request.post(`${API_BASE}/__admin/new-booking`, { data: { name: "Timeout Patient", minutesFromNow: 20 } });
    const { reference } = (await created.json()) as { reference: string };
    await page.goto("/admin/bookings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("searchbox", { name: "Search reference or patient name" }).and(page.locator(":visible")).fill(reference.slice(-6));
    const row = page.locator(`tr[data-ref="${reference}"]`);
    await expect(row).toBeVisible();

    await setMode(API_BASE, "admin-slow");
    await row.getByRole("button", { name: /^Arrived/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Mark arrived" }).click();
    await expect(page.getByText("We could not reach the service, so the change may not have been saved.")).toBeVisible({ timeout: 20_000 });

    const posts = (log: AdminLogEntry[]) => log.filter((e) => e.method === "POST" && e.path === `/admin/bookings/${reference}/status`);
    const log = await adminLog();
    const changeAt = log.findIndex((e) => posts([e]).length === 1);
    expect(posts(log)).toHaveLength(1);
    // Re-read straight after the failure (the list search), not retried.
    await expect.poll(async () => (await adminLog()).slice(changeAt + 1).some((e) => e.path === "/admin/bookings/search")).toBe(true);

    await setMode(API_BASE, "ok");
    await page.waitForTimeout(3000);
    expect(posts(await adminLog())).toHaveLength(1);
    await expect(row.locator(".pill")).toHaveText("Confirmed"); // the slow change never reached the backend
  });
});

test.describe("the public site is unaffected (NFR-002)", () => {
  for (const mode of ["admin-down", "admin-slow"] as const) {
    test(`booking an appointment works while the staff backend is ${mode === "admin-down" ? "down" : "slow"}`, async ({ page }) => {
      await setMode(API_BASE, mode);
      await bookAppointment(page);
      expect((await adminLog()).length).toBe(0); // the public pages never call the staff API
    });
  }

  test("booking works for a visitor whose demo starts are used up", async ({ browser, baseURL }) => {
    // The mock always refuses demo starts from this address (429), like an exhausted per-IP demo limit.
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.99" } });
    const page = await context.newPage();
    await startDemo(page);
    await expect(page).toHaveURL(/\/admin\/login\?demo=busy$/);
    await bookAppointment(page);
    await context.close();
  });
});
