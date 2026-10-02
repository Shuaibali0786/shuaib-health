import { expect, test } from "@playwright/test";
import { scrollThrough } from "./helpers";

/** Inline-hidden reveal blocks: Reveal arms below-the-fold content with style opacity 0 after hydration. */
const hiddenCount = (page: import("@playwright/test").Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main *")].filter((element) => element.style.opacity === "0").length);

test.describe("motion", () => {
  test("with reduced motion nothing moves, scales or is hidden", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Reveal never arms (hides) any block, and never animates.
    expect(await hiddenCount(page)).toBe(0);
    await scrollThrough(page);

    const moving = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => {
          const transform = getComputedStyle(element).transform;
          return transform !== "none" && transform !== "matrix(1, 0, 0, 1, 0, 0)";
        })
        .map((element) => `${element.tagName}.${String(element.className).slice(0, 40)}`),
    );
    expect(moving, "no element has a transform").toEqual([]);

    const transformAnimations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const keyframes = (animation as CSSTransition & { effect?: KeyframeEffect }).effect?.getKeyframes?.() ?? [];
          return keyframes.some((keyframe) => "transform" in keyframe || "translate" in keyframe || "scale" in keyframe);
        }).length,
    );
    expect(transformAnimations, "no running animation changes transform").toBe(0);
  });

  test("with reduced motion, hovering a card does not lift it", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover needs a pointer");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const card = page.locator("section[aria-labelledby='departments-title'] article").first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(400);
    expect(await card.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  });

  test("with motion allowed, blocks below the fold are revealed with an opacity animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => hiddenCount(page), { message: "below-the-fold blocks are armed after hydration" }).toBeGreaterThan(5);

    // Watch for an opacity animation while scrolling the doctors section into view.
    const sawOpacityAnimation = await page.evaluate(async () => {
      const target = document.querySelector("section[aria-labelledby='departments-title']")!;
      let seen = false;
      const poll = () => {
        if (document.getAnimations().some((animation) => (animation as CSSTransition & { effect?: KeyframeEffect }).effect?.getKeyframes?.().some((keyframe) => "opacity" in keyframe))) seen = true;
      };
      target.scrollIntoView({ block: "start" });
      for (let i = 0; i < 40; i++) {
        poll();
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      return seen;
    });
    expect(sawOpacityAnimation).toBe(true);

    await scrollThrough(page);
    expect(await hiddenCount(page), "after scrolling past, everything is visible again").toBe(0);
  });

  test("the page is fully readable without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const heading of ["Our departments", "Featured doctors", "Latest health tips", "Book your appointment"]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    await expect(page.locator("footer").getByRole("link", { name: "Designed & built by Shuaib Ali" })).toBeVisible();
    await context.close();
  });
});
