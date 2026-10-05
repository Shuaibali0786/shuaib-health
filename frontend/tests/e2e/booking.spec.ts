import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// The two Playwright projects (mobile, desktop) run in parallel against one mock API, so each uses its
// own doctors; a shared reset would wipe the other project's booking half way through. The mock's
// store starts empty on every run, and the flow always picks the first free day and time it is shown.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const KEYBOARD_DOCTOR = { mobile: "Dr. Omar Sheikh", desktop: "Dr. Hassan Mirza" } as const;
const AXE_DOCTOR = { mobile: { department: "Pediatrics", name: "Dr. Sana Farooqui" }, desktop: { department: "Cardiology", name: "Dr. Imran Qureshi" } } as const;
const TIME_ZONE_LABEL = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", timeZoneName: "long" })
  .formatToParts(new Date())
  .find((part) => part.type === "timeZoneName")?.value;

type ProjectName = "mobile" | "desktop";

/** Presses Tab until `target` has focus. Proves the control can be reached with the keyboard alone. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 120; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`could not reach ${String(target)} with Tab`);
}

async function stepHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 2, name })).toBeFocused();
}

async function violations(page: Page): Promise<string[]> {
  // The step entrance fades in for a quarter of a second; axe must not read colours half way through it.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id} (${violation.impact}) on ${violation.nodes[0]?.target.join(" ")}`);
}

test.describe("booking an appointment", () => {
  test("a visitor books with the keyboard alone in under a minute", async ({ page }, testInfo) => {
    const doctor = KEYBOARD_DOCTOR[testInfo.project.name as ProjectName];
    const started = Date.now();

    await page.goto("/book-appointment");
    await expect(page.getByRole("heading", { level: 1, name: "Book an appointment" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a department" })).toBeVisible();

    await tabTo(page, page.getByRole("button", { name: /General Medicine/ }));
    await page.keyboard.press("Enter");
    await stepHeading(page, "Choose a doctor");

    await tabTo(page, page.getByRole("button", { name: `Select ${doctor}` }));
    await page.keyboard.press("Enter");
    await stepHeading(page, "Choose a date");

    const day = page.locator('input[name="date"]:not([disabled])').first();
    await expect(day).toBeVisible();
    const date = await day.getAttribute("value");
    await tabTo(page, day);
    await page.keyboard.press("Space");
    await tabTo(page, page.getByRole("button", { name: "Continue" }));
    await page.keyboard.press("Enter");
    await stepHeading(page, "Choose a time");

    // The zone is named in words, next to the times.
    await expect(page.getByText(new RegExp(String(TIME_ZONE_LABEL)))).toBeVisible();
    const timeInput = page.locator('input[name="time"]').first();
    const time = await timeInput.getAttribute("value");
    await tabTo(page, timeInput);
    await page.keyboard.press("Space");
    await tabTo(page, page.getByRole("button", { name: "Continue" }));
    await page.keyboard.press("Enter");
    await stepHeading(page, "Your details");

    await tabTo(page, page.getByLabel("Full name"));
    await page.keyboard.type("Ali Khan");
    await tabTo(page, page.getByLabel("Mobile number"));
    await page.keyboard.type("0300 1234567");
    await tabTo(page, page.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await page.keyboard.press("Space");
    await tabTo(page, page.getByRole("button", { name: "Confirm booking" }));
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    const elapsed = Date.now() - started;
    testInfo.annotations.push({ type: "booking-time-ms", description: String(elapsed) });
    expect(elapsed).toBeLessThan(60_000);

    const card = page.getByRole("article");
    await expect(card.getByText(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/)).toBeVisible();
    await expect(card).toContainText("A**** K****");
    await expect(card).toContainText("0300****567");
    await expect(card).toContainText(doctor);
    await expect(card).toContainText(String(time));
    await expect(card).toContainText(String(TIME_ZONE_LABEL));
    await expect(card).toContainText(/PKR [\d,]+/);
    await expect(card).toContainText("Demo booking, no one will contact you");
    await expect(card).not.toContainText("Ali Khan");
    await expect(card).not.toContainText("1234567");
    await expect(page.getByRole("heading", { name: "Before your visit" })).toBeVisible();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The address bar and the page carry no personal details, and a reload shows the same masked view.
    expect(page.url()).not.toMatch(/Ali|Khan|0300|1234567/);
    const before = await card.innerText();
    await page.reload();
    await expect(page.getByRole("article")).toBeVisible();
    expect(await page.getByRole("article").innerText()).toBe(before);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("every step and the confirmation page are free of serious accessibility violations", async ({ page }, testInfo) => {
    const { department, name } = AXE_DOCTOR[testInfo.project.name as ProjectName];

    await page.goto("/book-appointment");
    await expect(page.getByRole("heading", { level: 2, name: "Choose a department" })).toBeVisible();
    expect(await violations(page), "department step").toEqual([]);

    await page.getByRole("button", { name: new RegExp(department) }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
    expect(await violations(page), "doctor step").toEqual([]);

    await page.getByRole("button", { name: `Select ${name}` }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a date" })).toBeVisible();
    await page.locator('input[name="date"]:not([disabled])').first().click();
    expect(await violations(page), "date step").toEqual([]);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toBeVisible();
    await page.locator('input[name="time"]').first().click();
    expect(await violations(page), "time step").toEqual([]);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
    expect(await violations(page), "details step").toEqual([]);

    // With errors showing, too.
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("alert", { name: /problems? with your details/ })).toBeVisible();
    expect(await violations(page), "details step with errors").toEqual([]);

    await page.getByLabel("Full name").fill("Ali Khan");
    await page.getByLabel("Mobile number").fill("03001234567");
    await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/\/book-appointment\/confirmed\//);
    await expect(page.getByRole("article")).toBeVisible();
    expect(await violations(page), "confirmation page").toEqual([]);
  });

  test("steps change without any running transform or opacity animation under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/book-appointment");
    await expect(page.getByRole("heading", { level: 2, name: "Choose a department" })).toBeVisible();

    const running = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const keyframes = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
            return keyframes.some((frame) => "transform" in frame || "opacity" in frame);
          })
          .map((animation) => animation.id || animation.constructor.name),
      );

    expect(await running()).toEqual([]);
    await page.getByRole("button", { name: /General Medicine/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
    expect(await running()).toEqual([]);
    await page.getByRole("button", { name: /^Select Dr\. / }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "Choose a date" })).toBeVisible();
    expect(await running()).toEqual([]);
  });
});
