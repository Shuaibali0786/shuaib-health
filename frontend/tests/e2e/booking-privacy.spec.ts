import { expect, test } from "@playwright/test";

// Distinctive values: if any of them reaches a URL or the mock API's request log, this test fails.
const PERSONAL = {
  name: "Zubair Testcase",
  mobile: "03123456789",
  email: "zubair.testcase@example.com",
  reason: "private-reason-text",
};
// Not used by the other booking specs, and one per project so the two projects never race for a slot.
const DOCTOR = { mobile: { department: "Gynecology", name: "Dr. Ayesha Rahman" }, desktop: { department: "Pathology Lab", name: "Dr. Zainab Memon" } } as const;
const API_BASE = "http://127.0.0.1:4010";

test("a full booking puts no personal data in any URL or in the API request log", async ({ page }, testInfo) => {
  const { department, name } = DOCTOR[testInfo.project.name as "mobile" | "desktop"];
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  const pageUrls: string[] = [];
  const noteUrl = () => pageUrls.push(page.url());

  await page.goto("/book-appointment");
  noteUrl();
  await page.getByRole("button", { name: new RegExp(department) }).click();
  await page.getByRole("button", { name: `Select ${name}` }).click();
  noteUrl();
  await page.locator('input[name="date"]:not([disabled])').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  noteUrl();
  await page.locator('input[name="time"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your details" })).toBeVisible();
  noteUrl();

  await page.getByLabel("Full name").fill(PERSONAL.name);
  await page.getByLabel("Mobile number").fill(PERSONAL.mobile);
  await page.getByLabel(/Email/).fill(PERSONAL.email);
  await page.getByLabel(/Reason/).fill(PERSONAL.reason);
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  noteUrl();
  await page.reload();
  await expect(page.getByRole("article")).toBeVisible();
  noteUrl();

  const forbidden = [PERSONAL.name, PERSONAL.mobile, "+923123456789", PERSONAL.email, PERSONAL.reason, "Zubair", "Testcase"];
  const everything = [...urls, ...pageUrls].flatMap((url) => [url, decodeURIComponent(url)]).join("\n");
  for (const value of forbidden) expect(everything, `${value} in a URL`).not.toContain(value);

  const log = JSON.stringify(await (await fetch(`${API_BASE}/__log`)).json());
  for (const value of forbidden) expect(log, `${value} in the mock API log`).not.toContain(value);

  // The confirmation page is never indexed and never leaks itself as a referrer.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});
