import { requestLog } from "../mock-api";
import { API_BASE, expect, test } from "./fixtures";

// Proves the stateful design holds: `next dev` still goes through the data cache (so a page opened
// twice quickly calls the API once) and a refresh after the 3 s window reaches the API. If either
// check fails, stop: the failure-path specs would pass without testing anything.
test("the data cache is active in dev and refreshes after its window", async ({ page }) => {
  await page.goto("/doctors");
  await page.goto("/doctors");
  const quick = await requestLog(API_BASE);
  expect(quick.doctors, "doctors requests after two quick visits").toBe(1);

  await page.waitForTimeout(4000);
  await page.goto("/doctors");
  await page.goto("/doctors");
  await expect
    .poll(async () => (await requestLog(API_BASE)).doctors ?? 0, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(2);
});
