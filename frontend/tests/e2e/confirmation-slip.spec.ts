import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs on Android Chrome (project "mobile", Pixel 7), iPhone Safari (project "iphone", WebKit) and
// "desktop". The projects share one mock API, so each books with its own doctor.
const DOCTOR = {
  mobile: { department: "Dermatology", name: "Dr. Maryam Baloch" },
  iphone: { department: "Pediatrics", name: "Dr. Faisal Chaudhry" },
  desktop: { department: "Dental", name: "Dr. Bilal Ansari" },
} as const;
type ProjectName = keyof typeof DOCTOR;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PRIVATE = /Ali Khan|03001234567|0300 ?1234567|1234567/;

async function book(page: Page, department: string, doctor: string): Promise<string> {
  await page.goto("/book-appointment");
  await page.getByRole("button", { name: new RegExp(department) }).click();
  await page.getByRole("button", { name: `Select ${doctor}` }).click();
  await page.locator('input[name="date"]:not([disabled])').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Ali Khan");
  await page.getByLabel("Mobile number").fill("03001234567");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page).toHaveURL(/\/book-appointment\/confirmed\/[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  return page.url().split("/").pop()!;
}

test.describe("confirmation slip", () => {
  test("a visitor can keep, share and print their slip without exposing personal details", async ({ page }, testInfo) => {
    const project = testInfo.project.name as ProjectName;
    const { department, name } = DOCTOR[project];
    const reference = await book(page, department, name);
    const isDesktop = project === "desktop";

    const notice = page.getByText("Save this slip: tap Download or take a screenshot. Show this reference at the clinic.");
    const card = page.getByRole("article");
    const download = page.getByRole("button", { name: "Download your slip" });
    const print = page.getByRole("button", { name: "Print" });
    const whatsapp = page.getByRole("link", { name: "Share on WhatsApp" });
    const calendar = page.getByRole("button", { name: "Add to calendar" });
    const another = page.getByRole("link", { name: "Book another appointment" });

    await test.step("notice, card and all actions are there", async () => {
      await expect(notice).toBeVisible();
      for (const control of [download, print, whatsapp, calendar, another]) await expect(control).toBeVisible();
    });

    await test.step("layout follows the screen", async () => {
      const [n, c, d, p, a] = await Promise.all([notice, card, download, print, another].map((l) => l.boundingBox()));
      expect(n!.y).toBeLessThan(c!.y);
      expect(d!.height).toBeGreaterThanOrEqual(48);
      if (isDesktop) {
        // Two columns: the actions sit to the right of the card, level with its top.
        expect(d!.x).toBeGreaterThanOrEqual(c!.x + c!.width);
        expect(d!.y).toBeLessThan(c!.y + 200);
        expect(a!.x).toBeGreaterThanOrEqual(c!.x + c!.width);
      } else {
        // One column: card, then Download, then the other actions.
        expect(c!.y).toBeLessThan(d!.y);
        expect(d!.y).toBeLessThan(p!.y);
        expect(p!.y).toBeLessThan(a!.y);
        // Download stays on screen while the visitor is still reading the card.
        await page.evaluate(() => window.scrollTo(0, 0));
        const viewport = page.viewportSize()!;
        const sticky = (await download.boundingBox())!;
        expect(sticky.y + sticky.height).toBeLessThanOrEqual(viewport.height);
        expect(sticky.y).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    });

    await test.step("axe finds no serious problems", async () => {
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });

    if (!isDesktop) {
      await test.step("on a phone the PDF goes to the share sheet as a file", async () => {
        await page.evaluate(() => {
          const w = window as unknown as { __shared?: { name: string; type: string; size: number } };
          Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async (data: ShareData) => {
              const file = data.files![0]!;
              w.__shared = { name: file.name, type: file.type, size: file.size };
            },
          });
        });
        await download.click();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: unknown }).__shared)).toEqual({
          name: `appointment-slip-${reference}.pdf`,
          type: "application/pdf",
          size: expect.any(Number),
        });
        await page.evaluate(() => {
          Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
          Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
        });
      });
    } else {
      await test.step("desktop never opens the share sheet", async () => {
        await page.evaluate(() => Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }));
      });
    }

    await test.step("without sharing, the PDF downloads and holds only masked details", async () => {
      const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
      expect(file.suggestedFilename()).toBe(`appointment-slip-${reference}.pdf`);
      const path = await file.path();
      const text = (await readFile(path)).toString("latin1");
      expect(text.startsWith("%PDF-")).toBe(true);
      expect(text).toContain(reference);
      expect(text).toContain(name);
      expect(text).toContain("A**** K****");
      expect(text).toContain("0300****567");
      expect(text).not.toMatch(PRIVATE);
    });

    await test.step("calendar file is in Pakistan time", async () => {
      const [file] = await Promise.all([page.waitForEvent("download"), calendar.click()]);
      expect(file.suggestedFilename()).toBe(`appointment-${reference}.ics`);
      const text = (await readFile(await file.path())).toString("utf8");
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("DTSTART;TZID=Asia/Karachi:");
      expect(text).toContain(reference);
      expect(text).not.toMatch(PRIVATE);
    });

    await test.step("WhatsApp message has the visit facts and nothing private", async () => {
      const href = (await whatsapp.getAttribute("href"))!;
      expect(href.startsWith("https://wa.me/?text=")).toBe(true);
      const text = decodeURIComponent(href.split("?text=")[1]!);
      expect(text).toContain(reference);
      expect(text).toContain(name);
      expect(text).toMatch(/Time: \d\d:\d\d \(PKT\)/);
      expect(text).toMatch(/Clinic phone: /);
      expect(text).not.toMatch(PRIVATE);
      expect(text).not.toContain("****");
    });

    await test.step("Print opens the print dialog", async () => {
      await page.evaluate(() => {
        (window as unknown as { __printed: number }).__printed = 0;
        window.print = () => {
          (window as unknown as { __printed: number }).__printed += 1;
        };
      });
      await print.click();
      expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    });

    await test.step("Book another appointment starts a fresh flow", async () => {
      await another.click();
      await expect(page).toHaveURL(/\/book-appointment$/);
      await expect(page.getByRole("heading", { level: 2, name: "Choose a department" })).toBeVisible();
    });
  });
});
