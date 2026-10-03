import { expect, test } from "@playwright/test";
import { ALL_PATHS } from "./helpers";

test.describe("images", () => {
  test("Chrome reports no lazy-loaded image without explicit dimensions on any page", async ({ page, context, browserName }) => {
    test.setTimeout(180_000);
    test.skip(browserName !== "chromium", "uses the Chrome DevTools Audits domain");
    const cdp = await context.newCDPSession(page);
    const issues: string[] = [];
    cdp.on("Audits.issueAdded", (event: { issue: { code: string } }) => issues.push(event.issue.code));
    await cdp.send("Audits.enable");
    for (const path of ALL_PATHS) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(300);
      expect(issues.filter((code) => code === "LazyLoadImageIssue"), path).toEqual([]);
    }
  });
});
