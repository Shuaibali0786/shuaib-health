// Feature 010: the chat assistant. The normal e2e build has ASSISTANT_ENABLED unset (off): no button.
// Run with the flag on to test the widget: `ASSISTANT_ENABLED=true npx playwright test assistant`.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ON = ["true", "1", "yes", "on"].includes((process.env.ASSISTANT_ENABLED ?? "").toLowerCase());
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("assistant", () => {
  test("is absent when the flag is off (default)", async ({ page }) => {
    test.skip(ON, "flag is on in this run");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Ask us" })).toHaveCount(0);
  });

  test("answers from the clinic's data, guides to booking, and passes axe", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true");
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Your question").fill("Dr Ayesha fee");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog.getByRole("log")).toContainText("Gynecology");
    await expect(dialog.getByRole("link", { name: /Book with Dr\. Ayesha Rahman/ })).toHaveAttribute("href", /\/book-appointment\?doctor=dr-ayesha-rahman/);

    const results = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask us" })).toBeFocused();
  });
});
