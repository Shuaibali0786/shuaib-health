import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./admin-helpers";
import { alertOf, createMember, TEMP_PASSWORD, uniqueEmail } from "./admin-auth-helpers";

// The Staff screen against the mock API (Feature 006, US2). The four admin projects run in parallel
// against one mock server, so every test works on its own freshly created member and never leaves the
// mock without its single seed admin.

const rowOf = (page: Page, email: string) => page.locator("tr", { hasText: email });
/** Opens the Staff screen and waits until the page has hydrated, so the first click or change is handled. */
async function openStaff(page: Page) {
  await page.goto("/admin/staff");
  await page.waitForLoadState("networkidle");
}

const TEMP_FORMAT = /^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){3}$/;

test.beforeEach(async ({ context, baseURL }) => signIn(context, "admin", baseURL!));

test("an admin adds a receptionist and sees the temporary password once", async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo, "added");
  await openStaff(page);
  await page.getByLabel("Name").fill("Reception One");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("receptionist");
  await page.getByRole("button", { name: "Add staff member" }).click();

  const dialog = page.getByRole("dialog", { name: "Account created" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("temp-password")).toHaveText(TEMP_FORMAT);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  const row = rowOf(page, email);
  await expect(row).toContainText("Reception One");
  await expect(row).toContainText("Active");
  await expect(row).toContainText("Must change password");
  await page.reload();
  await expect(page.getByTestId("temp-password")).toHaveCount(0);
});

test("a duplicate email says it is already in use", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "dup");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  await page.getByLabel("Name").fill("Someone Else");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Add staff member" }).click();
  await expect(alertOf(page)).toHaveText("That email is already in use.");
});

test("reset shows a new temporary password once and marks the account", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "reset");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  await rowOf(page, email).getByRole("button", { name: "Reset password" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("signed out everywhere");
  await confirm.getByRole("button", { name: "Reset password" }).click();

  const dialog = page.getByRole("dialog", { name: "Temporary password set" });
  const shown = await dialog.getByTestId("temp-password").textContent();
  expect(shown).toMatch(TEMP_FORMAT);
  expect(shown).not.toBe(TEMP_PASSWORD);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("temp-password")).toHaveCount(0);
  await expect(rowOf(page, email)).toContainText("Must change password");
});

test("cancelling the confirmation changes nothing", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "cancel");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  await rowOf(page, email).getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(rowOf(page, email)).toContainText("Active");
});

test("deactivate and reactivate", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "toggle");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  const row = rowOf(page, email);
  await row.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toContainText("Inactive");
  await row.getByRole("button", { name: "Reactivate" }).click();
  await expect(row).toContainText("Active");
  await expect(row.getByRole("button", { name: "Deactivate" })).toBeVisible();
});

test("change a role", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "role");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  const select = rowOf(page, email).getByRole("combobox");
  await expect(select).toHaveValue("receptionist");
  await select.selectOption("admin");
  await expect(alertOf(page)).toHaveCount(0);
  await expect(select).toHaveValue("admin");
  await page.reload();
  await expect(rowOf(page, email).getByRole("combobox")).toHaveValue("admin");
  await rowOf(page, email).getByRole("combobox").selectOption("receptionist");
  await expect(rowOf(page, email).getByRole("combobox")).toHaveValue("receptionist");
});

test("the last-admin refusal is explained calmly", async ({ page }) => {
  // The rule itself is proven by the backend tests; here the screen's copy is checked. The answer is
  // stubbed because parallel projects may promote other members while this test runs.
  await openStaff(page);
  await page.route("**/api/admin/staff/*", (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "last_admin", message: "There must be at least one active admin.", requestId: "t" } }) }),
  );
  await rowOf(page, "admin@clinic.test").getByRole("combobox").selectOption("receptionist");
  await expect(alertOf(page)).toHaveText("There must always be at least one active admin.");
  await expect(rowOf(page, "admin@clinic.test").getByRole("combobox")).toHaveValue("admin");
});

test("an unreachable service gets a calm message and keeps the list", async ({ page, request, baseURL }, testInfo) => {
  const email = uniqueEmail(testInfo, "offline");
  await createMember(request, baseURL!, email);
  await openStaff(page);
  await page.route("**/api/admin/staff/*", (route) => route.abort("failed"));
  await rowOf(page, email).getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(alertOf(page)).toHaveText("We could not reach the service. Please try again.");
  await expect(rowOf(page, email)).toContainText("Active");
});

test("the demo viewer sees a read-only sample list", async ({ page, context, baseURL }) => {
  await context.clearCookies();
  await signIn(context, "demo", baseURL!);
  await openStaff(page);
  await expect(page.getByText("The demo is read-only: changes are not saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add staff member" })).toHaveCount(0);
});
