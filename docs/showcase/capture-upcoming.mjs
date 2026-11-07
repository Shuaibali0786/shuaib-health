// Re-takes the Command Centre screenshots for the upcoming-bookings feature (Feature 012): the Overview with its
// count cards, Bookings by day, the Upcoming view grouped by day, and the bell. Sample data only.
// Run from frontend/ with the local mock build serving on :3100 (see README "Re-take"):
//   node ../docs/showcase/capture-upcoming.mjs ../docs/showcase
import { chromium, devices } from "@playwright/test";

const out = process.argv[2];
if (!out) throw new Error("usage: node capture-upcoming.mjs <output folder>");
const BASE = "http://localhost:3100";
const VIEWPORTS = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, mobile: { ...devices["Pixel 7"] } };

const browser = await chromium.launch();
for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const shot = (name, fullPage) => page.screenshot({ path: `${out}/${name}-${vp}.png`, fullPage });

  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /demo/i }).first().click();
  await page.waitForURL(/\/admin(\?|$)/);
  await page.waitForTimeout(1500);
  await shot("dashboard-overview", vp === "mobile");

  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("dashboard-bookings", false);

  await page.goto(`${BASE}/admin/bookings?view=upcoming`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("dashboard-upcoming", false);

  const bell = page.getByRole("button", { name: /^New bookings/ }).locator("visible=true").first();
  await bell.click();
  await page.waitForTimeout(400);
  await shot("dashboard-bell", false);
  await context.close();
}
await browser.close();
console.log("done");
