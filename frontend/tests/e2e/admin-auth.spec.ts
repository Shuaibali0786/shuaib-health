import { expect, test, type Page } from "@playwright/test";

import { SESSION_COOKIE, signIn } from "./admin-helpers";
import { alertOf, createMember, expectSignedOutPage, PASSWORD, signInThroughForm, TEMP_PASSWORD, uniqueEmail } from "./admin-auth-helpers";

// Staff sign-in against the mock API (Feature 006, US2): the form, roles, lockout, return paths, the
// session-expired dialog, the forced password change and sign-out.

const visibleNav = (page: Page) => page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible"));
const signOutButton = (page: Page) => page.getByRole("button", { name: "Sign out" });

test.describe("sign-in page", () => {
  test("is private, has no sign-up link and carries the disclaimer and the credit", async ({ page }) => {
    const response = await page.goto("/admin/login");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up|register|create account/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Designed & built by Shuaib Ali" })).toBeVisible();
    await expect(page.getByText("Portfolio demo — not a real clinic, not medical advice.")).toBeVisible();
  });

  test("an admin signs in and sees every screen", async ({ page }) => {
    await signInThroughForm(page, "admin@clinic.test", PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sample");
    await expect(visibleNav(page).getByRole("link", { name: /^Staff/ })).toBeVisible();
    await expect(visibleNav(page).getByRole("link", { name: /^Activity/ })).toBeVisible();
  });

  test("the cookie is __Host-, Secure, HttpOnly and SameSite=Strict, and the token never reaches the page", async ({ page, context }) => {
    await signInThroughForm(page, "admin@clinic.test", PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("cc_session");
    expect(await page.content()).not.toContain("cs_e2e-admin");
  });

  test("a receptionist sees no Activity or Staff, and gets the refusal page by URL", async ({ page }) => {
    await signInThroughForm(page, "receptionist@clinic.test", PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(visibleNav(page).getByRole("link")).toHaveCount(4);
    await expect(visibleNav(page).getByRole("link", { name: /Activity/ })).toHaveCount(0);
    await expect(visibleNav(page).getByRole("link", { name: /Staff/ })).toHaveCount(0);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "You do not have access to this page" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add staff member" })).toHaveCount(0);
  });

  test("a wrong password and an unknown email give the same generic message", async ({ page }) => {
    for (const email of ["admin@clinic.test", "nobody@clinic.test"]) {
      await signInThroughForm(page, email, "not-the-password-1");
      await expect(alertOf(page)).toHaveText("Email or password is incorrect.");
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByLabel("Password")).toHaveValue("");
    }
  });

  test("a locked account says to try again in 15 minutes", async ({ page }) => {
    await signInThroughForm(page, "locked@clinic.test", PASSWORD);
    await expect(alertOf(page)).toHaveText("Too many attempts — try again in 15 minutes.");
  });
});

test.describe("return path", () => {
  test("signed out, a private URL goes to sign-in and back after signing in", async ({ page }) => {
    await page.goto("/admin/staff");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fstaff$/);
    await page.getByLabel("Email").fill("admin@clinic.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/staff$/);
    await expect(page.getByRole("heading", { level: 1, name: "Staff" })).toBeVisible();
  });

  for (const next of ["https://evil.example/admin", "//evil.example", "/admin/../etc", "/elsewhere"]) {
    test(`rejects the off-site or malformed next=${next}`, async ({ page, baseURL }) => {
      await signInThroughForm(page, "admin@clinic.test", PASSWORD, `/admin/login?next=${encodeURIComponent(next)}`);
      await expect(page).toHaveURL(`${baseURL}/admin`);
    });
  }

  test("an already signed-in visitor to the sign-in page goes straight on", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/login?next=%2Fadmin%2Fstaff");
    await expect(page).toHaveURL(/\/admin\/staff$/);
  });
});

test.describe("session ended", () => {
  test("a request that finds the session over opens a dialog; signing in returns to the same screen", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/staff");
    await page.route("**/api/admin/staff/*", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "session_expired", message: "Your session has ended.", requestId: "t" } }) }),
    );
    const row = page.locator("tr", { hasText: "receptionist@clinic.test" });
    await row.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();

    const dialog = page.getByRole("dialog", { name: "Your session has ended" });
    await expect(dialog).toBeVisible();
    await page.unroute("**/api/admin/staff/*");
    await dialog.getByLabel("Email").fill("admin@clinic.test");
    await dialog.getByLabel("Password").fill(PASSWORD);
    await dialog.getByRole("button", { name: "Sign in" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/staff$/);
    await expect(page.getByRole("heading", { level: 1, name: "Staff" })).toBeVisible();
  });
});

test.describe("forced password change", () => {
  test("a temporary password must be replaced before anything else", async ({ page, request, baseURL }, testInfo) => {
    const email = uniqueEmail(testInfo, "forced");
    await createMember(request, baseURL!, email);
    await signInThroughForm(page, email, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/admin\/account\/password$/);
    await expect(page.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/account\/password$/);

    const fill = async (current: string, next: string, repeat: string) => {
      await page.getByLabel(/Temporary password|Current password/).fill(current);
      await page.getByLabel("New password", { exact: true }).fill(next);
      await page.getByLabel("Repeat new password").fill(repeat);
      await page.getByRole("button", { name: "Save new password" }).click();
    };
    await fill(TEMP_PASSWORD, "Another-Fine-Passphrase-7", "Another-Fine-Passphrase-8");
    await expect(alertOf(page)).toHaveText("The two new passwords do not match.");
    await fill(TEMP_PASSWORD, "password1234", "password1234");
    await expect(alertOf(page)).toContainText("too common");
    await fill("wrong-current-password", "Another-Fine-Passphrase-7", "Another-Fine-Passphrase-7");
    await expect(alertOf(page)).toHaveText("Your current password is not correct.");

    await fill(TEMP_PASSWORD, "Another-Fine-Passphrase-7", "Another-Fine-Passphrase-7");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Test");
  });
});

test.describe("sign out", () => {
  test("ends the session, clears the cookie and returns to sign-in", async ({ page, context }) => {
    await signInThroughForm(page, "admin@clinic.test", PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);
    await signOutButton(page).filter({ visible: true }).first().click();
    await expectSignedOutPage(page);
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE && c.value !== "")).toBe(false);
    await page.goto("/admin");
    await expectSignedOutPage(page);
  });
});
