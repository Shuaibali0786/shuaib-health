import { expect, test } from "@playwright/test";
import { ALL_PATHS, CREDIT, NOTICE } from "./helpers";

const BANNED_CLAIMS =
  /\b(ratings?|reviews?|testimonials?|awards?|award-winning|certified|certifications?|accredited|accreditations?|patients served|years of experience|best in|number one|top-rated)\b/i;

const BRAND_WORDS =
  /\b(apollo|aga khan|shifa|mayo clinic|cleveland clinic|johns hopkins|jci|iso 9001|google|facebook|whatsapp|pexels|unsplash|shutterstock)\b/i;

test.describe("honesty (constitution I)", () => {
  for (const path of ALL_PATHS) {
    test(`${path} shows the demo notice and the author credit`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      // Once in the top bar and once in the footer, so it is on screen even after scrolling.
      await expect(page.getByText(NOTICE)).toHaveCount(2);
      const credit = page.locator("footer").getByRole("link", { name: CREDIT.text });
      await expect(credit).toHaveAttribute("href", CREDIT.href);
      await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", "noindex, nofollow");
    });
  }

  test("the 404 page shows the notice and the credit too", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByText(NOTICE)).toHaveCount(2);
    await expect(page.locator("footer").getByRole("link", { name: CREDIT.text })).toHaveAttribute("href", CREDIT.href);
  });

  test("the Home page makes no fabricated claims and names no third-party brand", async ({ page }) => {
    await page.goto("/");
    const visibleText = await page.locator("body").innerText();
    const altText = await page.locator("img").evaluateAll((images) => images.map((image) => image.getAttribute("alt") ?? ""));
    const everything = [visibleText, ...altText, await page.title()].join("\n");

    expect(everything.match(BANNED_CLAIMS)?.[0] ?? null).toBeNull();
    expect(everything.match(BRAND_WORDS)?.[0] ?? null).toBeNull();
  });

  test("sample content is labelled: contact details, doctors, tips and the emergency number", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer").getByText("Sample details")).toBeVisible();
    await expect(page.locator("section[aria-labelledby='doctors-title']").getByText("Sample", { exact: true })).toHaveCount(4);
    await expect(page.locator("section[aria-labelledby='tips-title']").getByText("Sample", { exact: true })).toHaveCount(3);
    await expect(page.locator("aside[aria-labelledby='emergency-title']")).toContainText("(sample)");
    await expect(page.locator("section[aria-labelledby='doctors-title']")).toContainText("fictional");
  });

  test("the site never calls a backend: no request leaves the site's own origin", async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL ?? "") && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(foreign).toEqual([]);
  });
});

// The demo notice and the "Sample" labels stay visible through the whole booking flow (FR-051, FR-052).
// Picks the LAST free day and time, so it never takes the slot the other booking specs pick first.
const BOOKING_DOCTOR = { mobile: { department: "Gynecology", name: "Dr. Ayesha Rahman" }, desktop: { department: "Pathology Lab", name: "Dr. Zainab Memon" } } as const;
const DETAILS_NOTICE = "Demo site: please don't enter real medical details";

test("every booking step and the confirmation page show the demo notice and label the doctors Sample", async ({ page }, testInfo) => {
  const { department, name } = BOOKING_DOCTOR[testInfo.project.name as "mobile" | "desktop"];
  const noticeShown = async () => expect(page.getByText(NOTICE)).toHaveCount(2);

  await page.goto("/book-appointment");
  await noticeShown();
  await page.getByRole("button", { name: new RegExp(department) }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Choose a doctor" })).toBeVisible();
  await noticeShown();
  await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: `Select ${name}` }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Choose a date" })).toBeVisible();
  await noticeShown();
  // Focus then Space, as in booking.spec: a click can miss a day scrolled out of the strip.
  await page.locator('input[name="date"]:not([disabled])').last().focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Choose a time" })).toBeVisible();
  await noticeShown();
  await page.locator('input[name="time"]').last().focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
  await noticeShown();
  await expect(page.getByText(DETAILS_NOTICE, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your appointment" }).getByText("Sample", { exact: true })).toBeVisible();

  await page.getByLabel("Full name").fill("Honest Visitor");
  await page.getByLabel("Mobile number").fill("0312 9876543");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  await noticeShown();
  await expect(page.getByRole("article").getByText("Sample", { exact: true })).toBeVisible();
});
