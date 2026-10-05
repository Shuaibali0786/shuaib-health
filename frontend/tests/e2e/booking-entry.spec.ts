import { expect, test, type Page } from "@playwright/test";

// The Book buttons on a doctor's or department's page open the flow with that choice made (FR-071).
// Both projects share one mock API, so each books with its own doctor for the timing test.
const TIMING_DOCTOR = {
  mobile: { slug: "dr-ayesha-rahman", name: "Dr. Ayesha Rahman" },
  desktop: { slug: "dr-zainab-memon", name: "Dr. Zainab Memon" },
} as const;
type ProjectName = keyof typeof TIMING_DOCTOR;

async function tabTo(page: Page, target: ReturnType<Page["locator"]>): Promise<void> {
  for (let presses = 0; presses < 150; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("could not reach the control with Tab");
}

test.describe("booking entry points", () => {
  test("a doctor's Book button opens the date step with that doctor, and Back lets the visitor change doctor", async ({ page }) => {
    await page.goto("/doctors/dr-ayesha-rahman");
    await page.getByRole("main").getByRole("link", { name: "Book appointment" }).click();
    await expect(page).toHaveURL(/\/book-appointment\?doctor=dr-ayesha-rahman/);
    await expect(page.getByRole("heading", { level: 2, name: "Choose a date" })).toBeVisible();
    await expect(page.getByText(/With Dr\. Ayesha Rahman/)).toBeVisible();
    await expect(page.getByText(/Gynecology/).first()).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select Dr. Ayesha Rahman" })).toBeVisible(); // the doctor step, so the choice can be changed
  });

  test("a department's Book buttons open the doctor step", async ({ page }) => {
    await page.goto("/departments/cardiology");
    const links = page.getByRole("main").getByRole("link", { name: "Book appointment" });
    await expect(links).toHaveCount(2);
    for (const href of await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
      expect(href).toBe("/book-appointment?department=cardiology");
    }
    await links.first().click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Select Dr\./ }).first()).toBeVisible();
  });

  test("an unknown doctor starts at the department step with a polite note", async ({ page }) => {
    await page.goto("/book-appointment?doctor=unknown-slug");
    await expect(page.getByRole("heading", { level: 2, name: "Choose a department" })).toBeVisible();
    await expect(page.getByText("That doctor isn't available for online booking. Please choose a department.")).toBeVisible();
    await page.getByRole("button", { name: /General Medicine/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
    await expect(page.getByText("That doctor isn't available for online booking.")).toHaveCount(0);
  });

  test("from the doctor's page to the confirmation takes under 45 seconds, keyboard only (SC-001)", async ({ page }, testInfo) => {
    const doctor = TIMING_DOCTOR[testInfo.project.name as ProjectName];
    const started = Date.now();
    await page.goto(`/doctors/${doctor.slug}`);
    await tabTo(page, page.getByRole("main").getByRole("link", { name: "Book appointment" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Choose a date" })).toBeVisible();

    // ArrowLeft from the first option wraps to the last free date and time, so this never races another
    // spec that books the same doctor's first slot.
    await tabTo(page, page.locator('input[name="date"]:not([disabled])').first());
    await page.keyboard.press("ArrowLeft");
    await tabTo(page, page.getByRole("button", { name: "Continue" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toBeFocused();

    await tabTo(page, page.locator('input[name="time"]').first());
    await page.keyboard.press("ArrowLeft");
    await tabTo(page, page.getByRole("button", { name: "Continue" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeFocused();

    await page.getByLabel("Full name").fill("Ali Khan");
    await page.getByLabel("Mobile number").fill("03001234567");
    await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
    await tabTo(page, page.getByRole("button", { name: "Confirm booking" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);

    const seconds = (Date.now() - started) / 1000;
    testInfo.annotations.push({ type: "SC-001", description: `${seconds.toFixed(1)} s from the doctor page to the confirmation` });
    expect(seconds).toBeLessThan(45);
  });
});
