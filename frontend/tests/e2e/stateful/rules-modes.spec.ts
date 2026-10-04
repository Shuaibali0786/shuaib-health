import clinicRulesJson from "../../fixtures/api/clinic-rules.json";
import { CREDIT, NOTICE } from "../helpers";
import { requestLog, resetMode, setMode, type MockMode } from "../mock-api";
import { API_BASE, expect, test } from "./fixtures";

// US3: clinic settings and rules come from the API. Each mode is first seen in `ok`, then the mock is
// switched, the 3 s data window is outlasted, and the pages are polled for up to 10 s. The request log
// proves the clinic and rules were requested again after the switch (C2).
test.setTimeout(180_000);

const PAGES = ["/contact", "/book-appointment"] as const;
const RULE_COUNT = clinicRulesJson.items.length;

async function switchTo(mode: MockMode) {
  await resetMode(API_BASE);
  await setMode(API_BASE, mode);
}

test("rules-empty: the Before your visit section disappears", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2, name: "Before your visit" }), `${path} in ok`).toBeVisible();
  }

  await switchTo("rules-empty");
  await page.waitForTimeout(4000);

  for (const path of PAGES) {
    await expect
      .poll(
        async () => {
          await page.goto(path);
          return page.getByRole("heading", { name: "Before your visit" }).count();
        },
        { message: path, timeout: 10_000 },
      )
      .toBe(0);
    // The rest of the page is unaffected.
    await expect(page.getByRole("banner")).toBeVisible();
  }

  const log = await requestLog(API_BASE);
  expect(log["clinic-rules"] ?? 0, "clinic-rules requests after the switch").toBeGreaterThanOrEqual(1);
});

test("rebrand: new name, emergency number and an extra rule appear; the honesty text does not change", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "Shuaib Health home" }).first(), `${path} in ok`).toBeVisible();
  }

  await switchTo("rebrand");
  await page.waitForTimeout(4000);

  for (const path of PAGES) {
    await expect
      .poll(
        async () => {
          await page.goto(path);
          return {
            title: await page.title(),
            header: await page.getByRole("banner").getByRole("link", { name: "Rebranded Clinic home" }).count(),
            footer: await page.getByRole("contentinfo").getByText("© 2026 Rebranded Clinic").count(),
            emergency: await page.getByRole("banner").getByRole("link", { name: /\+92 300 1234567/ }).count(),
            rules: await page.getByRole("region", { name: "Before your visit" }).getByRole("listitem").count(),
          };
        },
        { message: path, timeout: 10_000 },
      )
      .toEqual({ title: expect.stringContaining("Rebranded Clinic"), header: 1, footer: 1, emergency: 1, rules: RULE_COUNT + 1 });

    await expect(page.getByRole("banner").getByRole("link", { name: /\+92 300 1234567/ })).toHaveAttribute("href", "tel:+923001234567");
    await expect(page.getByText("Please bring your previous reports to the visit.")).toBeVisible();

    // The demo notice and the credit are constitution text: unchanged, whatever the data says (K1).
    await expect(page.getByText(NOTICE).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: CREDIT.text })).toHaveAttribute("href", CREDIT.href);
  }

  const log = await requestLog(API_BASE);
  expect(log.clinic ?? 0, "clinic requests after the switch").toBeGreaterThanOrEqual(1);
  expect(log["clinic-rules"] ?? 0, "clinic-rules requests after the switch").toBeGreaterThanOrEqual(1);
});
