import { expect, test } from "@playwright/test";

import { clippedElements } from "./helpers/clipping";

// Self-test of the clipping helper (T125): a fixture that is clipped in every way the helper knows must fail it,
// and a clean fixture must pass it. It needs no server: the pages are built in the browser.

const BAD = `<!doctype html><meta name="viewport" content="width=device-width">
<style>
  body { margin: 0; font: 16px sans-serif }
  .box { width: 80px; height: 24px; overflow: hidden }
  .label { display: block; width: 60px; white-space: nowrap }
  .wide { width: 2000px; height: 10px; background: #ccc }
</style>
<div class="box"><div style="width:300px">content wider than a clipping box</div></div>
<div class="label">a nowrap label that runs out of its box</div>
<div class="wide"></div>`;

const GOOD = `<!doctype html><meta name="viewport" content="width=device-width">
<style>
  body { margin: 0; font: 16px sans-serif }
  .box { width: 200px; overflow: hidden }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; white-space: nowrap }
</style>
<div class="box"><p>fits</p></div>
<span class="sr-only">a long visually hidden sentence that is wider than its one pixel box</span>
<table><thead style="position:absolute;width:1px;height:1px;overflow:hidden"><tr><th>Person</th><th>A wide column heading</th></tr></thead></table>
<div class="box" data-clip-ok><div style="width:900px">deliberately clipped, and marked so</div></div>`;

test("the helper reports sideways scroll, a clipping box and a spilling label", async ({ page }) => {
  await page.setContent(BAD);
  const found = await clippedElements(page);
  expect(found.some((line) => line.startsWith("page scrolls sideways"))).toBe(true);
  expect(found.some((line) => line.startsWith("div.box"))).toBe(true);
  expect(found.some((line) => line.startsWith("div.label"))).toBe(true);
});

test("the helper stays quiet on a clean page, visually hidden text and a marked box", async ({ page }) => {
  await page.setContent(GOOD);
  expect(await clippedElements(page)).toEqual([]);
});
