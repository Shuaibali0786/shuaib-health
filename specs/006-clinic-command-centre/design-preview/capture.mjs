// Captures every preview variant to ./screenshots with the clock frozen, and fails if anything is clipped.
// Run from the repo root:  node specs/006-clinic-command-centre/design-preview/capture.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../../frontend/package.json"));
const { chromium } = require("playwright");

const out = join(here, "screenshots");
mkdirSync(out, { recursive: true });

// Mon 5 Oct 2026, 11:20:45 clinic time (Asia/Karachi = UTC+5).
const FROZEN = new Date("2026-10-05T06:20:45Z");
const devices = {
  phone: { width: 390, height: 844 },
  "laptop-1280": { width: 1280, height: 800 },
  "laptop-1366": { width: 1366, height: 768 },
  desktop: { width: 1440, height: 900 },
};
const views = [
  { screen: "overview", state: "list", name: "overview", fullPage: true, clipCheck: true },
  { screen: "bookings", state: "list", name: "bookings", fullPage: true, clipCheck: true },
  { screen: "bookings", state: "drawer", name: "bookings-drawer" },
  { screen: "bookings", state: "confirm", name: "bookings-confirm" },
  { screen: "overview", state: "list", name: "overview-chip", desktopOnly: true, act: "chip" },
  { screen: "overview", state: "list", name: "overview-new-booking", act: "simulate" },
];

// Elements whose content overflows a clipping box, plus any sideways page scroll.
function findClipped() {
  const bad = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".sr-only") || el.closest(".mix-bar") || el.offsetParent === null) continue;
    const cs = getComputedStyle(el);
    const clipsX = /hidden|clip/.test(cs.overflowX), clipsY = /hidden|clip/.test(cs.overflowY);
    // Leaf text boxes that spill out of themselves (e.g. a nowrap label running under a neighbour).
    const spills = !el.children.length && cs.display !== "inline" && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1;
    if (spills || (clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 1)) {
      bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
    }
  }
  return bad;
}

const browser = await chromium.launch();
let count = 0;
const clipped = [];
for (const [device, viewport] of Object.entries(devices)) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: device === "phone" ? 2 : 1, timezoneId: "Europe/London" });
  for (const theme of ["light", "dark"]) {
    for (const v of views) {
      if (v.desktopOnly && device === "phone") continue;
      // Fresh page per shot: the clock is paused at FROZEN and only moves when runFor() says so.
      const page = await context.newPage();
      await page.clock.install({ time: new Date(FROZEN.getTime() - 1000) });
      await page.clock.pauseAt(FROZEN);
      const url = new URL(pathToFileURL(join(here, "preview.html")));
      url.search = new URLSearchParams({ screen: v.screen, state: v.state, theme }).toString();
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.clock.runFor(1200); // finish the KPI count-up; no refresh or simulated booking fires yet
      if (v.act === "chip") await page.locator(".tl-b.confirmed").first().focus();
      if (v.act === "simulate") await page.evaluate(() => window.__preview.simulate());
      if (v.fullPage) await page.evaluate(() => document.documentElement.classList.add("capture-full"));
      if (v.clipCheck) for (const c of await page.evaluate(findClipped)) clipped.push(`${v.name} ${device} ${theme}: ${c}`);
      const file = join(out, `${v.name}_${device}_${theme}.png`);
      await page.screenshot({ path: file, fullPage: !!v.fullPage, animations: "disabled" });
      await page.close();
      count++;
    }
  }
  await context.close();
}
await browser.close();
console.log(`Saved ${count} screenshots to ${out}`);
if (clipped.length) {
  console.error(`Clipped content found:\n  ${clipped.join("\n  ")}`);
  process.exit(1);
}
