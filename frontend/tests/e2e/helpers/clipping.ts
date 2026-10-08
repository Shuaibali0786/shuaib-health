import { expect, type Page } from "@playwright/test";

/**
 * The clipping check (FR-045), ported from the approved design preview (`design-preview/capture.mjs`,
 * `findClipped`). It runs inside the page and reports, as readable strings:
 *
 *  - a page that scrolls sideways,
 *  - a box that clips its content (`overflow: hidden | clip`) while the content is bigger than the box,
 *  - a leaf text box that spills out of itself (a no-wrap label running under its neighbour, or text that an
 *    ellipsis is hiding).
 *
 * Boxes that are invisible (`.sr-only`, squeezed to 1 x 1 px for screen readers, not displayed) and the stacked status bar, which is a set of
 * proportional slices with no text, are skipped. Anything else that is found is a defect to fix, not to ignore.
 *
 * It must stay a plain function with no outside references: Playwright serialises it into the page.
 */
export function findClipped(): string[] {
  const bad: string[] = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
    if (el.closest(".sr-only") || el.closest(".mix-bar") || el.closest("[data-clip-ok]") || el.offsetParent === null) continue;
    if (el.clientWidth <= 1 && el.clientHeight <= 1) continue; // visually hidden (a table head on a phone), read aloud
    const cs = getComputedStyle(el);
    const clipsX = /hidden|clip/.test(cs.overflowX);
    const clipsY = /hidden|clip/.test(cs.overflowY);
    const spills = !el.children.length && cs.display !== "inline" && (el.textContent ?? "").trim() !== "" && el.scrollWidth > el.clientWidth + 1;
    if (spills || (clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 1)) {
      bad.push(`${el.tagName.toLowerCase()}.${Array.from(el.classList).join(".")} (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
    }
  }
  return bad;
}

/** What is clipped on the page as it is now (an empty list means nothing is). */
export async function clippedElements(page: Page): Promise<string[]> {
  return page.evaluate(findClipped);
}

/** Fails the test, naming every clipped box, when anything on the page is clipped. */
export async function expectNoClipping(page: Page, label = "page"): Promise<void> {
  expect(await clippedElements(page), `${label}: clipped or spilling content`).toEqual([]);
}
