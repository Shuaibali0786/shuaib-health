import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { departments } from "../../fixtures/catalog/departments";
import { doctors } from "../../fixtures/catalog/doctors";
import { labTests } from "../../fixtures/catalog/labTests";
import { ALL_PATHS, CREDIT, NOTICE } from "../helpers";
import { FALLBACK_PHONE } from "./fallback";

// Production build made and served while the catalog API is dead (connection refused). Every page
// must still render with the site chrome; catalog sections say they are unavailable; nothing 404s.

const UNAVAILABLE = /temporarily unavailable/i;

/** Pages whose content is (partly) catalog data. */
const CATALOG_PATHS = new Set([
  "/",
  "/doctors",
  "/departments",
  "/lab-tests",
  "/health-packages",
  `/doctors/${doctors[0]!.slug}`,
  `/departments/${departments[0]!.slug}`,
  `/lab-tests/${labTests[0]!.slug}`,
]);

for (const path of ALL_PATHS) {
  test(`${path}: renders with the site chrome while the API is dead`, async ({ page, isMobile }) => {
    const response = await page.goto(path);
    expect(response?.status(), "status").toBe(200);

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // Navigation: the menu button on phones, the primary links from the xl breakpoint up.
    if (isMobile) await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Open menu" }).or(page.getByRole("navigation", { name: "Primary" }))).toBeVisible();

    // Demo notice (constitution I) and the credit link in the footer (K2).
    await expect(page.getByText(NOTICE).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: CREDIT.text })).toHaveAttribute("href", CREDIT.href);

    // The emergency number comes from CLINIC_FALLBACK_JSON, so it is on every page.
    await expect(page.locator(`a[href="tel:${FALLBACK_PHONE.tel}"]`).first()).toBeAttached();

    if (CATALOG_PATHS.has(path)) await expect(page.getByText(UNAVAILABLE).first()).toBeVisible();
  });
}

test("an unknown doctor slug shows the friendly message, not a 404", async ({ page }) => {
  const response = await page.goto("/doctors/any-slug");
  expect(response?.status()).toBe(200);
  await expect(page.getByText(UNAVAILABLE).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Call the clinic" }).first()).toHaveAttribute("href", `tel:${FALLBACK_PHONE.tel}`);
});

for (const path of ["/", "/doctors"]) {
  test(`${path}: no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
}

// Booking with the API dead (Principle V): the page renders a friendly "call the clinic" state, never a crash.
test("/book-appointment shows the unavailable state with a phone link and the demo notice", async ({ page }) => {
  const response = await page.goto("/book-appointment");
  expect(response?.status()).toBe(200);
  const main = page.getByRole("main");
  await expect(main.getByText("Online booking is temporarily unavailable. Please call the clinic.")).toBeVisible();
  await expect(main.getByRole("link", { name: /^Call / })).toHaveAttribute("href", /^tel:\+?\d+$/);
  await expect(main.getByRole("link", { name: "Retry" })).toBeVisible();
  await expect(page.getByText(NOTICE).first()).toBeVisible();
});

test("a confirmation link shows the friendly page, with the reference and the clinic phone", async ({ page }) => {
  const response = await page.goto("/book-appointment/confirmed/ABCDE-FGHJK");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "We can't show your booking right now" })).toBeVisible();
  await expect(page.getByText("ABCDE-FGHJK").first()).toBeVisible();
  await expect(page.getByRole("main").getByText(/call the clinic on/i)).toBeVisible();
});
