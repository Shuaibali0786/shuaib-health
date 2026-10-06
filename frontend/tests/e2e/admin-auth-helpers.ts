import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

/** The password of the mock API's test accounts (tests/mock-api/admin.mjs). */
export const PASSWORD = "Correct-Horse-9-Battery";
export const TEMP_PASSWORD = "abcd-efgh-jkmn-pqrs";

/** Signs in through the real form and waits for the redirect away from the login page. */
export async function signInThroughForm(page: Page, email: string, password: string, from = "/admin/login"): Promise<void> {
  await page.goto(from);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function expectSignedOutPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
}

/** An email no other test (or project running in parallel) uses. */
export function uniqueEmail(testInfo: TestInfo, label: string): string {
  const stamp = `${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.parallelIndex}-${Date.now() % 1_000_000}`;
  return `${label}.${stamp}@clinic.test`.toLowerCase();
}

/** Creates a staff member through the BFF as the mock admin, so a test has its own account to change. */
export async function createMember(request: APIRequestContext, baseURL: string, email: string, role: "admin" | "receptionist" = "receptionist", name = "Test Person"): Promise<void> {
  const response = await request.post("/api/admin/staff", {
    headers: { origin: baseURL, cookie: "__Host-cc_session=cs_e2e-admin", "x-csrf-token": "csrf-cs_e2e-admin", "content-type": "application/json" },
    data: { email, displayName: name, role, temporaryPassword: TEMP_PASSWORD },
  });
  expect(response.status()).toBe(201);
}

/** The inline error line of a form. (Next.js also keeps an empty role="alert" route announcer on every page.) */
export const alertOf = (page: Page) => page.locator('p[role="alert"]');
