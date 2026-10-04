import { requestLog, setMode } from "../mock-api";
import { API_BASE, expect, test } from "./fixtures";

// US1: a doctor added to the catalog after the site was built shows up without a rebuild. The
// stateful server uses a 3 s data window, so a few seconds after the switch the new record must
// be listed and have its own page.
test("a doctor added after the build is listed and opens at its own address", async ({ page, request }) => {
  await page.goto("/doctors");
  await expect(page.getByText("Dr Test New")).toHaveCount(0);

  await setMode(API_BASE, "extra");
  await page.waitForTimeout(4000);

  await expect
    .poll(async () => (await request.get("/doctors/dr-test-new")).status(), { timeout: 10_000 })
    .toBe(200);
  await page.goto("/doctors/dr-test-new");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Test New");

  await page.goto("/doctors");
  await expect(page.getByRole("link", { name: /Test New/ }).first()).toBeVisible();

  const log = await requestLog(API_BASE);
  expect(log.doctors ?? 0, "doctors requests after the switch").toBeGreaterThanOrEqual(1);

  expect((await request.get("/doctors/does-not-exist")).status()).toBe(404);
});
