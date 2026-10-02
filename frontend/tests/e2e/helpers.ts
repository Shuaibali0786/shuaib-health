import type { Page } from "@playwright/test";

/** Exact strings from the spec, repeated here on purpose: if the product text changes, a test must fail. */
export const NOTICE = "Portfolio demo — not a real clinic, not medical advice.";

export const CREDIT = {
  text: "Designed & built by Shuaib Ali",
  href: "https://github.com/Shuaibali0786",
} as const;

export const NAV_LABELS = [
  "Home",
  "About",
  "Doctors",
  "Departments",
  "Lab Tests",
  "Health Packages",
  "Health Tips",
  "Contact",
] as const;

/** The h2 headings of the Home page after the hero, in order ("At a glance" is visually hidden). */
export const HOME_SECTION_HEADINGS = [
  "How can we help you?",
  "Our departments",
  "At a glance",
  "Why choose Shuaib Health",
  "Featured doctors",
  "Latest health tips",
  "Book your appointment",
] as const;

/** Every page the site serves: Home plus the 26 "Coming soon" placeholders (contracts/routes.md). */
export const ALL_PATHS = [
  "/",
  "/about",
  "/doctors",
  "/departments",
  "/lab-tests",
  "/health-packages",
  "/health-tips",
  "/contact",
  "/book-appointment",
  "/home-sample-collection",
  "/privacy",
  "/terms",
  "/doctors/dr-hassan-mirza",
  "/doctors/dr-imran-qureshi",
  "/doctors/dr-sana-farooqui",
  "/doctors/dr-ayesha-rahman",
  "/departments/general-medicine",
  "/departments/cardiology",
  "/departments/pediatrics",
  "/departments/gynecology",
  "/departments/dermatology",
  "/departments/dental",
  "/departments/pathology-lab",
  "/health-tips/staying-hydrated",
  "/health-tips/healthy-sleep-habits",
  "/health-tips/balanced-plate",
  "/health-tips/daily-walk",
] as const;

/** Scrolls the whole page in steps so every scroll-triggered reveal runs, then returns to the top. */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
}
