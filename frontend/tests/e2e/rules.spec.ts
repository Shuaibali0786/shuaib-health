import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import clinicRulesJson from "../fixtures/api/clinic-rules.json";
import { scrollThrough } from "./helpers";

// The clinic rules ("Before your visit") from the API, in the order the clinic set. The main config
// runs the mock in `ok` only; the rules-empty and rebrand modes are in stateful/rules-modes.spec.ts.
const RULES = [...clinicRulesJson.items].sort((a, b) => a.sortOrder - b.sortOrder).map((rule) => rule.text);
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of ["/contact", "/book-appointment"]) {
  test.describe(path, () => {
    test("shows Before your visit with the clinic's rules, in order", async ({ page }) => {
      await page.goto(path);
      const heading = page.getByRole("heading", { level: 2, name: "Before your visit" });
      await expect(heading).toBeVisible();
      const items = page.getByRole("region", { name: "Before your visit" }).getByRole("listitem");
      await expect(items).toHaveCount(5);
      await expect(items).toHaveText(RULES.map((text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
    });

    test("has no accessibility violations", async ({ page }) => {
      await page.goto(path);
      await scrollThrough(page);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
    });
  });
}
