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
