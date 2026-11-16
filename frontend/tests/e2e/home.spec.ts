import { expect, test } from "@playwright/test";
import { CREDIT, HOME_SECTION_HEADINGS, NAV_LABELS, NOTICE } from "./helpers";

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // Owner 2026-11-15: ONE slim banner at the top (it replaces the two dark bars); the footer keeps the full notice.
  test("shows one slim demo banner at the top and the full demo notice, exactly, in the footer", async ({ page }) => {
    const banner = page.getByTestId("announcement-bar");
    await expect(banner).toBeVisible();
    // The exact notice (constitution I) is in the banner and in the footer.
    await expect(banner).toContainText(NOTICE);
    await expect(banner.getByRole("button")).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(2);
    await expect(page.getByText(NOTICE).first()).toBeVisible();
    await expect(page.locator("footer").getByText(NOTICE)).toBeVisible();
    // Nothing else is stacked above the header.
    const bannerBox = await banner.boundingBox();
    expect(bannerBox?.height).toBeLessThanOrEqual(41);
    expect((await page.locator("header").boundingBox())?.y).toBeLessThanOrEqual(42);
  });

  test("header: logo, navigation or menu, emergency phone and Book Appointment", async ({ page, isMobile }) => {
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Shuaib Health home" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Book Appointment" }).first()).toBeVisible();

    if (isMobile) {
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
      await expect(header.getByRole("link", { name: /Call emergency phone/ })).toBeVisible();
      await header.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("navigation", { name: "Mobile" });
      await expect(menu.getByRole("link")).toHaveCount(NAV_LABELS.length + 2); // 8 pages, the emergency phone, Book Appointment
      for (const label of NAV_LABELS) await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
      await expect(menu.getByRole("link", { name: /\+92 21 0000 0000/ })).toHaveAttribute("href", "tel:+922100000000");
      await expect(menu.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
    } else {
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("link")).toHaveText([...NAV_LABELS]);
      await expect(header.getByRole("link", { name: /\+92 21 0000 0000/ })).toHaveAttribute("href", "tel:+922100000000");
      await expect(header.getByRole("link", { name: /Emergency \(sample\)/ })).toBeVisible();
      await expect(header.getByRole("button", { name: /menu/i })).toBeHidden();
    }
  });

  test("hero: one h1, both buttons, exactly three honest fact cards and a strip of real counts", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Care that feels calm and clear");

    const hero = page.locator("section[aria-labelledby='hero-title']");
    await expect(hero.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
    await expect(hero.getByRole("link", { name: "Find a Doctor" })).toHaveAttribute("href", "/doctors");
    await expect(hero.locator("li.hero-float")).toHaveText([
      "Open Mon–Sat, 9 AM – 9 PM PKT",
      "Lab reports online",
      "Home sample collection",
    ]);
    // Owner 2026-11-15: the trust strip counts the demo data (9 doctors, 7 departments, 26 lab tests) and says so.
    const strip = hero.getByTestId("trust-strip");
    await expect(strip).toContainText("9 doctors");
    await expect(strip).toContainText("7 departments");
    await expect(strip).toContainText("26 lab tests");
    await expect(strip).toContainText("24/7 online booking");
    await expect(strip).toContainText("sample data");
    await expect(strip).not.toContainText("AI receptionist"); // voice is off in this build
    await expect(page.getByTestId("talk-to-ayesha")).toHaveCount(0);
  });

  test("sections appear in the required order", async ({ page }) => {
    const headings = await page.locator("main h2").allTextContents();
    expect(headings.map((heading) => heading.trim())).toEqual([...HOME_SECTION_HEADINGS]);
  });

  test("Featured doctors has a View all doctors button to the Doctors page", async ({ page }) => {
    const button = page.locator("section[aria-labelledby='doctors-title']").getByRole("link", { name: "View all doctors" });
    await expect(button).toHaveAttribute("href", "/doctors");
    await button.click();
    await expect(page).toHaveURL(/\/doctors$/);
  });

  test("shows 5 quick actions, 7 departments, 4 sample doctors and 3 sample tips", async ({ page }) => {
    await expect(page.locator("section[aria-labelledby='quick-actions-title'] ul > li")).toHaveCount(5);
    await expect(page.locator("section[aria-labelledby='departments-title'] ul > li")).toHaveCount(7);

    const doctors = page.locator("section[aria-labelledby='doctors-title'] article");
    await expect(doctors).toHaveCount(4);
    for (const doctor of await doctors.all()) {
      await expect(doctor.getByText("Sample", { exact: true })).toBeVisible();
      await expect(doctor).toContainText(/PKR [\d,]+/);
    }

    const tips = page.locator("section[aria-labelledby='tips-title'] article");
    await expect(tips).toHaveCount(3);
    for (const tip of await tips.all()) await expect(tip.getByText("Sample", { exact: true })).toBeVisible();
  });

  test("the emergency card has a tap-to-call link to a sample number and advice to go to the nearest ER", async ({ page }) => {
    const card = page.locator("aside[aria-labelledby='emergency-title']");
    const call = card.getByRole("link");
    await expect(call).toHaveAttribute("href", "tel:+922100000000");
    await expect(call).toContainText("(sample)");
    await expect(card).toContainText("nearest emergency room");
  });

  test("the footer credits the author with the right link", async ({ page }) => {
    const credit = page.locator("footer").getByRole("link", { name: CREDIT.text });
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute("href", CREDIT.href);
  });

  test("every image loads", async ({ page }) => {
    await page.evaluate(async () => {
      const height = document.documentElement.scrollHeight;
      for (let y = 0; y < height; y += 400) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await expect
      .poll(async () =>
        page.evaluate(() => [...document.querySelectorAll("main img")].filter((img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0).length),
      )
      .toBe(0);
    expect(await page.locator("main img").count()).toBe(16);
  });
});

test.describe("first screen on phones", () => {
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [390, 844],
    [412, 915],
  ] as const) {
    test(`at ${width}x${height} the banner, header, headline and both hero buttons are visible without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const hero = page.locator("section[aria-labelledby='hero-title']");
      await expect(page.getByTestId("announcement-bar")).toBeInViewport({ ratio: 1 });
      await expect(page.locator("header").getByRole("link", { name: "Shuaib Health home" })).toBeInViewport();
      await expect(page.getByRole("button", { name: /menu/i })).toBeInViewport();
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(hero.getByRole("link", { name: "Book Appointment" })).toBeInViewport({ ratio: 1 });
      await expect(hero.getByRole("link", { name: "Find a Doctor" })).toBeInViewport({ ratio: 1 });
    });
  }
});
