import { expect, test } from "@playwright/test";
import { CREDIT, HOME_SECTION_HEADINGS, NAV_LABELS, NOTICE } from "./helpers";

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the demo notice exactly, at the top and in the footer", async ({ page }) => {
    await expect(page.getByText(NOTICE)).toHaveCount(2);
    await expect(page.getByText(NOTICE).first()).toBeVisible();
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

  test("hero: one h1, both buttons and exactly three honest fact cards", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Care that feels calm and clear");

    const hero = page.locator("section[aria-labelledby='hero-title']");
    await expect(hero.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
    await expect(hero.getByRole("link", { name: "Find a Doctor" })).toHaveAttribute("href", "/doctors");
    await expect(hero.getByRole("listitem")).toHaveText([
      "Open Mon–Sat, 9 AM – 9 PM PKT",
      "Lab reports online",
      "Home sample collection",
    ]);
  });

  test("sections appear in the required order", async ({ page }) => {
    const headings = await page.locator("main h2").allTextContents();
    expect(headings.map((heading) => heading.trim())).toEqual([...HOME_SECTION_HEADINGS]);
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
    test(`at ${width}x${height} the notice, header, headline and both hero buttons are visible without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const hero = page.locator("section[aria-labelledby='hero-title']");
      await expect(page.getByText(NOTICE).first()).toBeInViewport();
      await expect(page.locator("header").getByRole("link", { name: "Shuaib Health home" })).toBeInViewport();
      await expect(page.getByRole("button", { name: /menu/i })).toBeInViewport();
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(hero.getByRole("link", { name: "Book Appointment" })).toBeInViewport({ ratio: 1 });
      await expect(hero.getByRole("link", { name: "Find a Doctor" })).toBeInViewport({ ratio: 1 });
    });
  }
});
