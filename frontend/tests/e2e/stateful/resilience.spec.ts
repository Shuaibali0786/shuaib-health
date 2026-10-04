import { departments } from "../../fixtures/catalog/departments";
import { doctors } from "../../fixtures/catalog/doctors";
import { healthPackages } from "../../fixtures/catalog/healthPackages";
import { labTests } from "../../fixtures/catalog/labTests";
import { requestLog, resetMode, setMode, type MockMode } from "../mock-api";
import { API_BASE, expect, test } from "./fixtures";

// US2: when the API is down, slow, erroring or sends garbage, pages keep showing the last good data,
// return 200 within 4 s, and never show the "unavailable" message. Each route is first opened in
// `ok`, then the mode is switched, the 3 s data window is outlasted, and the route is requested
// again. The request log proves the failing API was really called after the switch.
test.setTimeout(300_000);

const doctor = doctors.find((candidate) => candidate.isFeatured)!;
const department = departments[0]!;
const labTest = labTests[0]!;

const ROUTES = [
  { path: "/", resource: "departments", text: doctor.fullName },
  { path: "/doctors", resource: "doctors", text: doctor.fullName },
  { path: `/doctors/${doctor.slug}`, resource: "doctors", text: doctor.fullName },
  { path: `/departments/${department.slug}`, resource: "departments", text: department.name },
  { path: "/lab-tests", resource: "lab-tests", text: labTest.name },
  { path: `/lab-tests/${labTest.slug}`, resource: "lab-tests", text: labTest.name },
  { path: "/health-packages", resource: "health-packages", text: healthPackages[0]!.name },
] as const;

const MODES: MockMode[] = ["down", "slow", "error500", "malformed"];

for (const mode of MODES) {
  test(`keeps the last good data when the API is ${mode}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    // The previous spec may have left other data in the 3 s data cache. An expired entry is served
    // once more while it refreshes, so let it expire, touch every route, then check the fresh data.
    await page.waitForTimeout(4000);
    for (const route of ROUTES) await page.goto(route.path);
    await page.waitForTimeout(1500);
    for (const route of ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(route.text).first(), `${route.path} in ok`).toBeVisible();
    }

    await resetMode(API_BASE);
    await setMode(API_BASE, mode);
    await page.waitForTimeout(4000);

    for (const route of ROUTES) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const started = Date.now();
        const response = await page.goto(route.path);
        const elapsed = Date.now() - started;
        expect(response?.status(), `${route.path} status (${mode}, try ${attempt})`).toBe(200);
        expect(elapsed, `${route.path} time (${mode}, try ${attempt})`).toBeLessThan(4000);
        await expect(page.getByText(route.text).first(), `${route.path} last good (${mode})`).toBeVisible();
        await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0);
      }
      const log = await requestLog(API_BASE);
      expect(log[route.resource] ?? 0, `${route.resource} requests after switching to ${mode}`).toBeGreaterThanOrEqual(1);
    }

    expect(consoleErrors).toEqual([]);
  });
}

// SC-005: once the API is back, fresh data replaces the last good data within the data window.
test("recovers by itself when the API comes back", async ({ page }) => {
  await page.waitForTimeout(4000);
  await page.goto("/doctors");
  await page.waitForTimeout(1500);
  await page.goto("/doctors");
  await expect(page.getByText(doctor.fullName).first()).toBeVisible();

  await setMode(API_BASE, "down");
  await page.waitForTimeout(4000);
  await page.goto("/doctors");
  await expect(page.getByText(doctor.fullName).first()).toBeVisible();

  await setMode(API_BASE, "rename");
  await page.waitForTimeout(4000);
  await expect
    .poll(
      async () => {
        await page.goto("/doctors");
        return (await page.locator("h1, h2, h3", { hasText: "Dr Renamed Test" }).count()) > 0;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});
