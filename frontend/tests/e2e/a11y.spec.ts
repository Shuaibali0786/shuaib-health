import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { scrollThrough } from "./helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("accessibility (WCAG 2.2 AA)", () => {
  for (const path of [
    "/",
    "/doctors",
    "/doctors?department=pediatrics",
    "/doctors?q=zzzz",
    "/doctors/dr-imran-qureshi",
    "/doctors/dr-zainab-memon",
    "/book-appointment",
    "/departments",
    "/departments/pediatrics",
    "/departments/pathology-lab",
    "/lab-tests",
    "/lab-tests?category=heart",
    "/lab-tests?q=zzzz",
    "/lab-tests/hba1c",
    "/health-tips/staying-hydrated",
    "/no-such-page",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await scrollThrough(page);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const summary = results.violations.map((violation) => `${violation.id} (${violation.impact}) on ${violation.nodes[0]?.target.join(" ")}`);
      expect(summary).toEqual([]);
    });
  }

  test("the page has landmarks, one main, ordered headings and a language", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const levels = await page.locator("h1, h2, h3").evaluateAll((headings) => headings.map((heading) => Number(heading.tagName[1])));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]! - levels[i - 1]!, "headings never skip a level going down").toBeLessThanOrEqual(1);
    }
  });

  test("keyboard: the skip link is the first stop and moves focus to the main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "needs a physical keyboard; covered on the desktop project");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  });

  test("keyboard: every tab stop on Home shows a visible focus ring and is not hidden under the sticky header", async ({ page, isMobile }) => {
    test.skip(isMobile, "needs a physical keyboard; covered on the desktop project");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const problems: string[] = [];
    let stops = 0;
    for (let i = 0; i < 120; i++) {
      const stop = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const hasRing = (style: CSSStyleDeclaration) =>
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2 && style.outlineColor !== "rgba(0, 0, 0, 0)";
        let ring = hasRing(getComputedStyle(element));
        for (let ancestor = element.parentElement, depth = 0; !ring && ancestor && depth < 4; ancestor = ancestor.parentElement, depth++) {
          ring = hasRing(getComputedStyle(ancestor));
        }
        const header = document.querySelector("header")!.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        const isSkipLink = element.getAttribute("href") === "#main-content";
        return {
          id: name,
          ring,
          underHeader: !element.closest("header") && !isSkipLink && box.top < header.bottom - 0.5 && box.bottom > 0,
          tooSmall: box.width < 24 || box.height < 24,
          first: isSkipLink,
        };
      });
      if (!stop) break;
      if (stops > 0 && stop.first) break; // wrapped around
      stops += 1;
      if (!stop.ring) problems.push(`no visible ring: ${stop.id}`);
      if (stop.underHeader) problems.push(`hidden under the header: ${stop.id}`);
      if (stop.tooSmall) problems.push(`smaller than 24x24: ${stop.id}`);
      await page.keyboard.press("Tab");
    }
    expect(stops).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });

  test("mobile menu: Escape closes it and returns focus to the menu button", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the menu only exists on phones and tablets");
    await page.goto("/");
    const button = page.getByRole("button", { name: "Open menu" });
    await button.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    const closed = page.getByRole("button", { name: "Open menu" });
    await expect(closed).toHaveAttribute("aria-expanded", "false");
    await expect(closed).toBeFocused();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });

  test("swipe rows can be used by keyboard: tabbing to a card scrolls the whole card into view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const links = page.locator("section[aria-labelledby='doctors-title'] article a");
    await links.first().scrollIntoViewIfNeeded();
    await links.first().focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    const lastCard = page.locator("section[aria-labelledby='doctors-title'] article").last();
    await expect(links.last()).toBeFocused();
    await expect
      .poll(async () => {
        const box = await lastCard.boundingBox();
        return box ? box.x >= 0 && box.x + box.width <= 390 + 1 : false;
      })
      .toBe(true);
  });
});
