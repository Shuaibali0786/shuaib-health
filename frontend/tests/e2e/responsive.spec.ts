import { expect, test, type Page } from "@playwright/test";
import { scrollThrough } from "./helpers";

// 640 px is a 1280 px window zoomed to 200%; 320 px is 400% zoom (WCAG 1.4.10 reflow).
const WIDTHS = [320, 390, 640, 1280] as const;
const PATHS = ["/", "/doctors", "/no-such-page"] as const;

/** Elements poking past the right or left edge, ignoring the contents of the deliberate swipe rows. */
async function elementsPastTheEdge(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (element.closest("[class*='snap-x']") && !element.matches("[class*='snap-x']")) continue;
      if (element.closest("#mobile-menu")) continue;
      const style = getComputedStyle(element);
      if (style.position === "fixed" || style.display === "none") continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.right > width + 1 || box.left < -1) found.push(`${element.tagName}.${String(element.className).slice(0, 40)} ${Math.round(box.left)}..${Math.round(box.right)}`);
    }
    return found;
  });
}

test.describe("responsive layout: no horizontal scrolling", () => {
  for (const width of WIDTHS) {
    for (const path of PATHS) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await scrollThrough(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "page is not wider than the screen").toBeLessThanOrEqual(0);
        expect(await elementsPastTheEdge(page)).toEqual([]);
      });
    }
  }

  test("the header stays on a single row at every common phone width", async ({ page }) => {
    for (const width of [320, 360, 375, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const height = await page.locator("header").evaluate((header) => header.getBoundingClientRect().height);
      expect(height, `header height at ${width}px (one row is about 65)`).toBeLessThanOrEqual(66);
    }
  });

  test("text spacing overrides (WCAG 1.4.12) do not push the page wider than the screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.addStyleTag({
      content: "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}",
    });
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: /menu/i })).toBeInViewport();
  });

  test("the phone layout is compact: departments in two columns, doctors and tips in swipe rows with the next card peeking", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await scrollThrough(page);

    const departmentLefts = await page
      .locator("section[aria-labelledby='departments-title'] ul > li")
      .evaluateAll((items) => [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().left)))]);
    expect(departmentLefts.length, "two columns").toBe(2);

    for (const id of ["doctors-title", "tips-title"]) {
      const row = page.locator(`section[aria-labelledby='${id}'] ul`);
      const info = await row.evaluate((list) => {
        const style = getComputedStyle(list);
        const cards = [...list.children].map((card) => card.getBoundingClientRect());
        return {
          overflowX: style.overflowX,
          snap: style.scrollSnapType,
          scrollable: list.scrollWidth > list.clientWidth,
          secondStartsAt: Math.round(cards[1]!.left),
          viewport: window.innerWidth,
        };
      });
      expect(info.overflowX).toBe("auto");
      expect(info.snap).toContain("mandatory");
      expect(info.scrollable).toBe(true);
      expect(info.secondStartsAt, "next card peeks in from the right").toBeLessThan(info.viewport - 30);
      expect(info.secondStartsAt).toBeGreaterThan(info.viewport * 0.6);
    }
  });

  test("tablet and desktop keep their grids (no swipe rows)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    for (const id of ["doctors-title", "tips-title"]) {
      const display = await page.locator(`section[aria-labelledby='${id}'] ul`).evaluate((list) => ({
        display: getComputedStyle(list).display,
        scrollable: list.scrollWidth > list.clientWidth,
      }));
      expect(display).toEqual({ display: "grid", scrollable: false });
    }
    const columns = await page
      .locator("section[aria-labelledby='doctors-title'] ul > li")
      .evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().left))).size);
    expect(columns).toBe(4);
  });
});
