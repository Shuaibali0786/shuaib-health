import { expect, test, type Page } from "@playwright/test";
import { departmentIdBySlug, NOTICE } from "./helpers";

const cards = (page: Page) => page.getByRole("article");

/** Opens the list and waits until the filter island has taken over from the server-rendered fallback. */
async function openDoctors(page: Page) {
  await page.goto("/doctors");
  await page.locator("[data-filters-ready]").waitFor();
}

test.describe("doctors list", () => {
  test("shows nine sample doctors, each labelled Sample profile, with the key facts", async ({ page }) => {
    await page.goto("/doctors");
    await expect(page.getByRole("heading", { level: 1, name: "Our doctors" })).toBeVisible();
    await expect(cards(page)).toHaveCount(9);
    await expect(cards(page).getByText("Sample profile", { exact: true })).toHaveCount(9);
    const imran = cards(page).filter({ hasText: "Dr. Imran Qureshi" });
    await expect(imran).toContainText("Cardiology");
    await expect(imran).toContainText("MBBS, FCPS (Cardiology)");
    await expect(imran).toContainText("Urdu, English");
    await expect(imran).toContainText("PKR 3,500");
    await expect(imran).toContainText(/Available|Next available/);
    await expect(imran.locator("img")).toHaveAttribute("alt", /Stock photo of a model presented as sample doctor Dr. Imran Qureshi/);
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("shows the breadcrumb Home > Doctors", async ({ page }) => {
    await page.goto("/doctors");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(crumbs.getByText("Doctors")).toHaveAttribute("aria-current", "page");
  });

  test("filters by department and keeps the filter in the URL across a reload", async ({ page }) => {
    await openDoctors(page);
    await page.getByLabel("Department", { exact: true }).selectOption({ label: "Pediatrics" });
    await expect(cards(page)).toHaveCount(2);
    await expect(page.getByRole("status")).toContainText("Showing 2 of 9 doctors");
    await expect(page).toHaveURL(/\?department=pediatrics$/);
    await page.reload();
    await expect(page.getByLabel("Department", { exact: true })).toHaveValue(departmentIdBySlug("pediatrics"));
    await expect(cards(page)).toHaveCount(2);
  });

  test("searches by name and by day, and combines them", async ({ page }) => {
    await openDoctors(page);
    await page.getByLabel("Search by name").fill("Dr. SANA ");
    await expect(cards(page)).toHaveCount(1);
    await page.getByLabel("Search by name").fill("");
    await page.getByLabel("Available on").selectOption({ label: "Friday" });
    await expect(cards(page).first()).toBeVisible();
    const friday = await cards(page).count();
    expect(friday).toBeGreaterThan(0);
    expect(friday).toBeLessThan(9);
    await page.getByLabel("Department", { exact: true }).selectOption({ label: "Pediatrics" });
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Dr. Faisal Chaudhry");
  });

  test("shows the empty state, and Clear filters brings all nine back", async ({ page }) => {
    await openDoctors(page);
    await page.getByLabel("Search by name").fill("zzzz");
    await expect(page.getByText("No doctors match your filters")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(9);
    await expect(page).toHaveURL(/\/doctors$/);
  });

  test("keeps the filters when you come back from a profile", async ({ page }) => {
    await openDoctors(page);
    await page.getByLabel("Department", { exact: true }).selectOption({ label: "Cardiology" });
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole("link", { name: "View profile: Dr. Imran Qureshi" }).click();
    await expect(page).toHaveURL(/\/doctors\/dr-imran-qureshi$/);
    await page.goBack();
    await expect(page.getByLabel("Department", { exact: true })).toHaveValue(departmentIdBySlug("cardiology"));
    await expect(cards(page)).toHaveCount(1);
  });

  test("shows the full list with the controls even without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/doctors");
    await expect(cards(page)).toHaveCount(9);
    await expect(page.getByLabel("Search by name")).toBeVisible();
    await expect(page.getByText(/Available (Mon|Tue|Wed|Thu|Fri|Sat)/).first()).toBeVisible();
    await context.close();
  });

  test("shows the next available day in Karachi time once the page is live", async ({ page }) => {
    // Monday 5 Oct 2026, 10:00 in Karachi. Dr. Hassan Mirza sits Monday 9 AM - 1 PM.
    await page.clock.install({ time: new Date("2026-10-05T10:00:00+05:00") });
    await page.goto("/doctors");
    await expect(cards(page).filter({ hasText: "Dr. Hassan Mirza" })).toContainText("Next available: Today, 9 AM – 1 PM PKT");
    // Dr. Sana Farooqui sits Mon, Tue and Thu 10 AM - 2 PM.
    await expect(cards(page).filter({ hasText: "Dr. Sana Farooqui" })).toContainText("Next available: Today, 10 AM – 2 PM PKT");
  });

  test("the filters can be used with the keyboard alone", async ({ page, isMobile }) => {
    test.skip(isMobile, "needs a physical keyboard; covered on the desktop project");
    await openDoctors(page);
    await page.getByLabel("Search by name").focus();
    await page.keyboard.type("faisal");
    await expect(cards(page)).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Department", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Available on")).toBeFocused();
  });

  test("makes no request to any other site while filtering", async ({ page, baseURL }) => {
    const external: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    page.on("request", (request) => {
      if (!request.url().startsWith("data:") && new URL(request.url()).origin !== origin) external.push(request.url());
    });
    await openDoctors(page);
    await page.getByLabel("Department", { exact: true }).selectOption({ label: "Pediatrics" });
    await page.getByLabel("Search by name").fill("faisal");
    await page.getByLabel("Available on").selectOption({ label: "Friday" });
    await expect(cards(page)).toHaveCount(1);
    expect(external).toEqual([]);
  });
});

test.describe("doctor profile", () => {
  test("shows the profile facts, the schedule table, the department link and the booking button", async ({ page }) => {
    await page.goto("/doctors/dr-imran-qureshi");
    await expect(page.getByRole("heading", { level: 1, name: "Dr. Imran Qureshi" })).toBeVisible();
    await expect(page.getByText("Sample profile", { exact: true })).toBeVisible();
    await expect(page.getByText("MBBS, FCPS (Cardiology)")).toBeVisible();
    await expect(page.getByText("15 years")).toBeVisible();
    await expect(page.getByText("(sample figure)")).toBeVisible();
    await expect(page.getByText("Urdu, English", { exact: true })).toBeVisible();
    await expect(page.getByText("PKR 3,500")).toBeVisible();
    await expect(page.getByText("Stock photo of a model. Sample profile — name and details are fictional.")).toBeVisible();

    const table = page.getByRole("table");
    await expect(table.getByRole("rowheader", { name: "Monday" })).toBeVisible();
    await expect(table).toContainText("4 PM – 8 PM");
    await expect(table).toContainText("Asia/Karachi");

    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Doctors" })).toHaveAttribute("href", "/doctors");
    await expect(crumbs.getByText("Dr. Imran Qureshi")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Cardiology", exact: true }).first()).toHaveAttribute("href", "/departments/cardiology");
  });

  test("Book appointment leads to the booking page", async ({ page }) => {
    await page.goto("/doctors/dr-imran-qureshi");
    await page.getByRole("main").getByRole("link", { name: "Book appointment", exact: true }).click();
    await expect(page).toHaveURL(/\/book-appointment\?doctor=dr-imran-qureshi/);
    await expect(page.getByRole("heading", { level: 1, name: "Book an appointment" })).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });

  test("every doctor has a profile page that opens", async ({ request }) => {
    for (const slug of [
      "dr-hassan-mirza",
      "dr-imran-qureshi",
      "dr-sana-farooqui",
      "dr-ayesha-rahman",
      "dr-maryam-baloch",
      "dr-bilal-ansari",
      "dr-zainab-memon",
      "dr-omar-sheikh",
      "dr-faisal-chaudhry",
    ]) {
      const response = await request.get(`/doctors/${slug}`);
      expect(response.status(), slug).toBe(200);
    }
  });

  test("an unknown doctor shows the not-found page with the site layout", async ({ page }) => {
    const response = await page.goto("/doctors/nobody");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
  });
});
