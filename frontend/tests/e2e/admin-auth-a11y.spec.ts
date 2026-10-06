import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { setTheme, signIn } from "./admin-helpers";
import { createMember, TEMP_PASSWORD, signInThroughForm, uniqueEmail } from "./admin-auth-helpers";

// Accessibility of the sign-in, forced-password and Staff screens, in both themes (WCAG 2.2 AA).

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test("sign-in page has no axe violations", async ({ page, context, baseURL }) => {
      await setTheme(context, theme, baseURL!);
      await page.goto("/admin/login");
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });

    test("Staff screen has no axe violations, with its dialogs open", async ({ page, context, baseURL, request }, testInfo) => {
      await signIn(context, "admin", baseURL!);
      await setTheme(context, theme, baseURL!);
      const email = uniqueEmail(testInfo, `axe${theme}`);
      await createMember(request, baseURL!, email);
      await page.goto("/admin/staff");
      await page.waitForLoadState("networkidle");
      const check = async (label: string) => {
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
      };
      await check("list");
      await page.locator("tr", { hasText: email }).getByRole("button", { name: "Reset password" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await check("confirm dialog");
      await page.getByRole("alertdialog").getByRole("button", { name: "Reset password" }).click();
      await expect(page.getByTestId("temp-password")).toBeVisible();
      await check("temporary password dialog");
    });

    test("forced password page has no axe violations", async ({ page, context, baseURL, request }, testInfo) => {
      await setTheme(context, theme, baseURL!);
      const email = uniqueEmail(testInfo, `axepw${theme}`);
      await createMember(request, baseURL!, email);
      await signInThroughForm(page, email, TEMP_PASSWORD);
      await expect(page).toHaveURL(/\/admin\/account\/password$/);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  });
}
