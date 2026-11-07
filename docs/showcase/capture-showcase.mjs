// Fiverr showcase screenshots against a LOCAL build + mock API (sample data only).
// Run from frontend/ (it imports @playwright/test from there): copy this file into frontend/, then
//   MSYS_NO_PATHCONV=1 node capture-showcase.mjs ../docs/showcase   (Git Bash) and delete the copy.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:3100";
const PRESETS = ["dental", "skin-aesthetic", "diagnostic-lab", "multi-speciality"];
const VIEWPORTS = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, mobile: { ...devices["Pixel 7"] } };
const log = (m) => console.log(m);

const browser = await chromium.launch();
for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: "reduce", colorScheme: "light" });
  const page = await ctx.newPage();
  const shot = async (name, full = true) => {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: `${out}/${name}-${vp}.png`, fullPage: full });
    log(`${name}-${vp}.png`);
  };

  for (const id of PRESETS) {
    await page.goto(`${BASE}/demo/specialties/${id}`, { waitUntil: "networkidle" });
    await shot(`preset-${id}-home`, false);
    await page.screenshot({ path: `${out}/preset-${id}-full-${vp}.png`, fullPage: true });
    await page.locator("section[aria-labelledby='preset-previews']").screenshot({ path: `${out}/preset-${id}-booking-slip-dashboard-${vp}.png` });
    log(`preset-${id}-full/previews-${vp}.png`);
  }

  // Real booking flow with fake details -> confirmation slip.
  await page.goto(`${BASE}/book-appointment`, { waitUntil: "networkidle" });
  await shot("booking-step1", false);
  await page.getByRole("button", { name: /General Medicine/ }).click();
  await page.getByRole("button", { name: /^Select Dr\./ }).first().click();
  await page.locator('input[name="date"]:not([disabled])').first().click();
  await shot("booking-step2-date", false);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="time"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Sana Example");
  await page.getByLabel("Mobile number").fill("03001234567");
  await page.getByRole("checkbox", { name: /I accept the clinic rules/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await page.waitForURL(/confirmed/);
  await page.getByRole("article").waitFor();
  await shot("slip", true);

  // Demo dashboard (Command Centre), opened the way a visitor does.
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /demo/i }).first().click();
  await page.waitForURL(/\/admin(\?|$)/);
  await page.waitForTimeout(1500);
  await shot("dashboard-overview", vp === "mobile");
  await page.goto(`${BASE}/admin/bookings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("dashboard-bookings", false);
  await page.goto(`${BASE}/admin/insights`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("dashboard-insights", false);
  await page.goto(`${BASE}/admin/staff`, { waitUntil: "networkidle" });
  await page.getByRole("table", { name: "What each role can do" }).scrollIntoViewIfNeeded();
  await shot("dashboard-roles", true);

  // Assistant (flag on in this local build).
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask us" }).click();
  const dialog = page.getByRole("dialog", { name: /Ask / });
  await dialog.getByLabel("Your question").fill("Dr Ayesha fee");
  await dialog.getByRole("button", { name: "Send" }).click();
  await dialog.getByRole("log").getByText(/Gynecology/).waitFor();
  await shot("assistant-patient", false);
  await dialog.getByRole("button", { name: "Clinic owner" }).click();
  await dialog.getByRole("button", { name: "Does it work for a dental clinic?" }).click();
  await dialog.getByRole("link", { name: "See the Dental demo" }).waitFor();
  await shot("assistant-owner", false);
  await ctx.close();
}
await browser.close();
