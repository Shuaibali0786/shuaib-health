import { expect, test } from "@playwright/test";

import { signIn, wcagViolations } from "./admin-helpers";
import { alertOf, PASSWORD, signInThroughForm } from "./admin-auth-helpers";

// Feature 011: two-step sign-in, against the mock API's two-factor test account (codes are fixed there).

const TWO_FACTOR_EMAIL = "two-factor@clinic.test";
const CODE = "123456";
const CHALLENGE_COOKIE = "__Host-cc_2fa";

test.describe("two-step sign-in", () => {
  test("the password alone opens no session; the app code does, and the challenge never reaches the page", async ({ page, context }) => {
    await signInThroughForm(page, TWO_FACTOR_EMAIL, PASSWORD);
    const field = page.getByLabel("Code from your authenticator app");
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "__Host-cc_session")).toBeUndefined();
    const challenge = cookies.find((c) => c.name === CHALLENGE_COOKIE);
    expect(challenge).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });
    expect(await page.content()).not.toContain(challenge?.value ?? "never");
    expect(await wcagViolations(page)).toEqual([]);

    await field.fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(alertOf(page)).toContainText("That code did not work. 4 tries left.");

    await field.fill(CODE);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
    const after = await context.cookies();
    expect(after.find((c) => c.name === "__Host-cc_session")).toBeDefined();
    expect(after.find((c) => c.name === CHALLENGE_COOKIE)).toBeUndefined();
  });

  test("a backup code works, and Start again goes back to the password", async ({ page }) => {
    await signInThroughForm(page, TWO_FACTOR_EMAIL, PASSWORD);
    await page.getByRole("button", { name: "Start again" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    await signInThroughForm(page, TWO_FACTOR_EMAIL, PASSWORD);
    await page.getByRole("button", { name: "Use a backup code instead" }).click();
    await page.getByLabel("Backup code").fill("abcde-fghjk");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("an account with two-step sign-in sees it on in Security", async ({ page }) => {
    await signInThroughForm(page, TWO_FACTOR_EMAIL, PASSWORD);
    await page.getByLabel("Code from your authenticator app").fill(CODE);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
    await page.goto("/admin/account/security");
    await expect(page.getByText("10 of 10 backup codes left.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn off" })).toBeVisible();
  });
});

test.describe("Security page", () => {
  test("an admin turns on two-step sign-in: QR code, key, code, backup codes", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    await page.goto("/admin/account/security");
    await expect(page.getByRole("heading", { level: 1, name: "Security" })).toBeVisible();
    expect(await wcagViolations(page)).toEqual([]);
    await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("img", { name: /QR code to add this account/ })).toBeVisible();
    await expect(page.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeVisible();
    expect(await wcagViolations(page)).toEqual([]);
    await page.getByLabel("Code from your authenticator app").fill(CODE);
    await page.getByRole("button", { name: "Turn on", exact: true }).click();
    await expect(page.getByRole("list", { name: "Backup codes" }).getByRole("listitem")).toHaveCount(10);
    const done = page.getByRole("button", { name: "Done" });
    await expect(done).toBeDisabled();
    await page.getByLabel("I have saved my backup codes.").check();
    await expect(done).toBeEnabled();
    expect(await wcagViolations(page)).toEqual([]);
  });

  test("a receptionist is told it is offered to admins; the demo is sent away", async ({ page, context, baseURL }) => {
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin/account/security");
    await expect(page.getByText("Two-step sign-in is offered to admin accounts.")).toBeVisible();
    await context.clearCookies();
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/account/security");
    await expect(page).toHaveURL(/\/admin\/?$/);
  });
});
