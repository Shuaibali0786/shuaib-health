import { expect, test } from "@playwright/test";
import { NOTICE } from "./helpers";

const DEPARTMENTS = [
  ["general-medicine", "General Medicine", 2],
  ["cardiology", "Cardiology", 1],
  ["pediatrics", "Pediatrics", 2],
  ["gynecology", "Gynecology", 1],
  ["dermatology", "Dermatology", 1],
  ["dental", "Dental", 1],
  ["pathology-lab", "Pathology Lab", 1],
] as const;

test.describe("departments list", () => {
  test("shows the seven sample departments in order, each linking to its page", async ({ page }) => {
    await page.goto("/departments");
    await expect(page.getByRole("heading", { level: 1, name: "Our departments" })).toBeVisible();
    const cards = page.getByRole("main").getByRole("article");
    await expect(cards).toHaveCount(7);
    for (const [index, [slug, name]] of DEPARTMENTS.entries()) {
      await expect(cards.nth(index).getByRole("heading", { level: 3, name })).toBeVisible();
      await expect(cards.nth(index).getByRole("link", { name })).toHaveAttribute("href", `/departments/${slug}`);
    }
    await expect(page.getByText("Sample departments")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByText("Departments")).toHaveAttribute("aria-current", "page");
  });

  test("a card opens its department page", async ({ page }) => {
    await page.goto("/departments");
    await page.getByRole("main").getByRole("link", { name: "Cardiology" }).click();
    await expect(page).toHaveURL(/\/departments\/cardiology$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cardiology" })).toBeVisible();
  });
});

test.describe("department pages", () => {
  for (const [slug, name, doctorCount] of DEPARTMENTS) {
    test(`${name} shows overview, conditions, services, ${doctorCount} doctor(s), related tests and booking`, async ({ page }) => {
      await page.goto(`/departments/${slug}`);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      const main = page.getByRole("main");
      for (const heading of ["Overview", "Common conditions (general list)", "Services offered", `Doctors in ${name}`, "Related lab tests"]) {
        await expect(main.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      }

      const doctorSection = main.locator("section[aria-labelledby='doctors-title']");
      await expect(doctorSection.getByRole("article")).toHaveCount(doctorCount);
      await expect(doctorSection.getByText("Sample profile", { exact: true })).toHaveCount(doctorCount);

      const testSection = main.locator("section[aria-labelledby='tests-title']");
      expect(await testSection.getByRole("article").count()).toBeGreaterThanOrEqual(3);
      await expect(testSection.getByText("Sample price").first()).toBeVisible();

      await expect(page.getByText("Illustrative image, not our actual facility.")).toBeVisible();
      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.getByRole("link", { name: "Departments" })).toHaveAttribute("href", "/departments");
      await expect(crumbs.getByText(name)).toHaveAttribute("aria-current", "page");
      await expect(page.getByText(NOTICE)).toHaveCount(2);
    });
  }

  test("every doctor and test link on every department page opens a real page", async ({ page, request }) => {
    for (const [slug] of DEPARTMENTS) {
      await page.goto(`/departments/${slug}`);
      const hrefs = await page
        .getByRole("main")
        .locator("a[href^='/doctors/'], a[href^='/lab-tests/']")
        .evaluateAll((anchors) => [...new Set(anchors.map((anchor) => anchor.getAttribute("href") ?? ""))]);
      expect(hrefs.length, slug).toBeGreaterThan(3);
      for (const href of hrefs) expect((await request.get(href)).status(), `${slug} -> ${href}`).toBe(200);
    }
  });

  test("the booking buttons lead to the booking page", async ({ page }) => {
    await page.goto("/departments/dental");
    const buttons = page.getByRole("main").getByRole("link", { name: "Book appointment", exact: true });
    expect(await buttons.count()).toBeGreaterThanOrEqual(1);
    await buttons.first().click();
    await expect(page).toHaveURL(/\/book-appointment\?department=dental/);
    await expect(page.getByRole("heading", { level: 1, name: "Book an appointment" })).toBeVisible();
  });

  test("a department link on a doctor profile leads back to the department", async ({ page }) => {
    await page.goto("/doctors/dr-sana-farooqui");
    await page.getByRole("main").getByRole("link", { name: "Pediatrics department" }).click();
    await expect(page).toHaveURL(/\/departments\/pediatrics$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pediatrics" })).toBeVisible();
  });

  test("an unknown department shows the not-found page in the site layout", async ({ page }) => {
    const response = await page.goto("/departments/nope");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("header")).toBeVisible();
  });
});
