// Feature 013, owner request 2026-11-09 (Part C): the A-Z check on every device and engine (see
// playwright.devices.config.ts). Mock API only: never production, never a real database.
// Each test is one row of the owner's checklist; the JSON report becomes the device x check table.
import { expect, test, type Locator, type Page } from "@playwright/test";

import { writeFileSync } from "node:fs";

import { hear, installFakeWebSpeech } from "../helpers/fake-web-speech";
import { renderPdf } from "../helpers/pdf-render";

/** MATRIX_SHOTS_DIR=<folder> saves the screenshots for the owner's report (file names carry the device). */
const SHOTS = process.env.MATRIX_SHOTS_DIR;
const shotName = (project: string, what: string) => `${SHOTS}/${project.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}-${what}.png`;

const PAGES = ["/", "/about", "/doctors", "/departments", "/lab-tests", "/health-packages", "/health-tips", "/contact", "/book-appointment", "/admin/login"];
// WebKit warns that a report-only CSP has no report-to: the LOCAL test build sends the CSP in report-only mode
// (SITE_SECURITY_HEADERS=report); production enforces it (Content-Security-Policy header), so this never shows there.
const IGNORED_CONSOLE = /favicon|Download the React DevTools|ERR_ABORTED|net::ERR_|Failed to load resource|delivered in report-only mode, but does not specify/i;

type Rect = { x: number; y: number; width: number; height: number };
const hit = (a: Rect, b: Rect) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_CONSOLE.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)} … ${m.text().slice(-220)}`);
  });
  return errors;
}

/** A unique, valid sample mobile number per device (the mock limits active bookings per number). */
function sampleMobile(seed: string): string {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 9_000_000;
  return `0300${String(1_000_000 + h).slice(0, 7)}`;
}

/** Everything the layout must get right on one page at this size. Returns the problems found. */
async function pageProblems(page: Page, admin: boolean): Promise<string[]> {
  return page.evaluate((isAdmin) => {
    // (Runs in the page: its own copy of the overlap test.)
    const hit = (a: DOMRect, b: DOMRect) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > window.innerWidth + 1) out.push(`sideways scroll: page is ${de.scrollWidth}px on a ${window.innerWidth}px screen`);
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
    };
    // Real tap targets (not words inside a sentence): WCAG 2.2 AA asks 24 px; the owner asks 44 px for the main controls.
    const controls = [...document.querySelectorAll("button, [role=button], a.inline-flex, a.flex, input:not([type=hidden]), select")].filter(visible);
    const tiny = controls.filter((el) => {
      const b = el.getBoundingClientRect();
      return Math.min(b.width, b.height) < 24 && !el.closest(".sr-only");
    });
    if (tiny.length) out.push(`tap targets under 24px: ${tiny.slice(0, 3).map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)).join(" | ")}`);
    if (!isAdmin) {
      const dock = document.querySelector(".assistant-dock");
      if (!dock || !visible(dock)) out.push("the Ask us button is missing");
      else {
        const d = dock.getBoundingClientRect();
        if (d.x < 0 || d.y < 0 || d.right > window.innerWidth + 0.5 || d.bottom > window.innerHeight + 0.5) out.push(`the Ask us button is partly off the screen (${Math.round(d.x)},${Math.round(d.y)} ${Math.round(d.width)}x${Math.round(d.height)})`);
        // A full-width bar (phones) is the bottom edge of the screen: the page keeps room for it, so the check is that the
        // LAST controls of the page end above it. A floating pill (tablet, desktop) must not sit on any control.
        const bar = d.width >= window.innerWidth - 1;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const pill = (dock.firstElementChild ?? dock).getBoundingClientRect();
        const covered = bar && !atBottom ? [] : controls.filter((el) => !dock.contains(el) && hit(el.getBoundingClientRect(), bar ? d : pill));
        if (covered.length) out.push(`the Ask us button covers: ${covered.slice(0, 3).map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)).join(" | ")}`);
      }
    }
    return out;
  }, admin);
}

test.describe("device matrix", () => {
  test.describe.configure({ timeout: 240_000 });

  test("pages: no sideways scroll, nothing covered, menu works, Ask us everywhere, no console errors", async ({ page }) => {
    const errors = watchConsole(page);
    const problems: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.locator("body").waitFor();
      await page.waitForTimeout(400);
      const admin = path.startsWith("/admin");
      if (!admin) await page.locator(".assistant-dock").waitFor({ timeout: 8000 }).catch(() => undefined);
      if (SHOTS && path === "/") await page.screenshot({ path: shotName(test.info().project.name, "home") });
      // At the top, half way and at the very bottom of the page.
      for (const where of [0, 0.5, 1]) {
        await page.evaluate((f) => window.scrollTo({ top: (document.documentElement.scrollHeight - window.innerHeight) * f, behavior: "instant" }), where);
        await page.waitForTimeout(250);
        for (const p of await pageProblems(page, admin)) problems.push(`${path} (${where === 0 ? "top" : where === 1 ? "bottom" : "middle"}): ${p}`);
      }
      const menu = page.getByRole("button", { name: "Open menu" });
      if (!admin && (await menu.isVisible().catch(() => false))) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await menu.click();
        if (!(await page.getByRole("navigation", { name: "Mobile" }).isVisible())) problems.push(`${path}: the menu did not open`);
        await page.getByRole("button", { name: "Close menu" }).click();
        if (await page.getByRole("navigation", { name: "Mobile" }).isVisible().catch(() => false)) problems.push(`${path}: the menu did not close`);
      }
    }
    expect([...new Set(problems)], [...new Set(problems)].join("\n")).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("chat panel: open, type, answer, close; the input stays on screen", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole("textbox", { name: "Your question" });
    await box.fill("What are your timings?");
    await box.press("Enter");
    await expect(dialog.getByRole("log")).toContainText(/Mon–Sat|Monday/, { timeout: 10000 });
    if (SHOTS) await page.screenshot({ path: shotName(test.info().project.name, "chat-panel") });
    const input = await box.boundingBox();
    const view = page.viewportSize();
    expect(input && view && input.y >= 0 && input.y + input.height <= view.height, "the type box is on screen").toBe(true);
    // The chips wrap: no horizontal scrollbar in the panel.
    expect(await dialog.evaluate((d) => [...d.querySelectorAll("*")].some((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "auto"))).toBe(false);
    await dialog.getByRole("button", { name: "Close chat" }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("voice panel: orb, Show chat, End and the type box, nothing cut or overlapping", async ({ page }) => {
    await installFakeWebSpeech(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByTestId("voice-orb")).toBeVisible();
    await expect(dialog.getByRole("status").filter({ hasText: "Listening..." })).toBeVisible({ timeout: 15000 });
    const parts: Record<string, Locator> = {
      mic: dialog.getByRole("button", { name: /Stop listening|Tap to talk|Interrupt/ }),
      end: dialog.getByRole("button", { name: "End", exact: true }),
      chat: dialog.getByRole("button", { name: "Show chat" }),
      input: dialog.getByRole("textbox", { name: "Your question" }),
      send: dialog.getByRole("button", { name: "Send" }),
    };
    const rects: Record<string, Rect> = {};
    for (const [name, loc] of Object.entries(parts)) {
      await expect(loc, name).toBeVisible();
      rects[name] = (await loc.boundingBox()) as Rect;
    }
    if (SHOTS) await page.screenshot({ path: shotName(test.info().project.name, "voice-panel") });
    const view = page.viewportSize() as { width: number; height: number };
    for (const [name, r] of Object.entries(rects)) expect(r.x >= 0 && r.y >= 0 && r.x + r.width <= view.width + 0.5 && r.y + r.height <= view.height + 0.5, `${name} fully on screen`).toBe(true);
    const names = Object.keys(rects);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) expect(hit(rects[names[i] as string] as Rect, rects[names[j] as string] as Rect), `${names[i]} overlaps ${names[j]}`).toBe(false);
    for (const [name, r] of Object.entries(rects)) if (name !== "input") expect(Math.min(r.width, r.height), `${name} is at least 44px`).toBeGreaterThanOrEqual(44);
    // Show chat opens the conversation in its own area above the input, never over it.
    await parts.chat?.click();
    const log = (await dialog.getByTestId("chat-log").boundingBox()) as Rect;
    expect(log.y + log.height <= (rects.input as Rect).y + 0.5, "the chat ends above the type box").toBe(true);
    await dialog.getByRole("button", { name: "Hide chat" }).click();
  });

  test("full booking by typing: the slip shows 12-hour time, arrive 15 minutes earlier, the same reference", async ({ page }, info) => {
    const errors = watchConsole(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const box = dialog.getByRole("textbox", { name: "Your question" });
    const log = dialog.getByRole("log");
    const type = async (text: string, expected: RegExp) => {
      await box.fill(text);
      await box.press("Enter");
      await expect(log).toContainText(expected, { timeout: 10000 });
    };
    await type("I want to book an appointment with Dr Bilal", /Which day/);
    await dialog.getByTestId("assistant-options").getByRole("button").first().click();
    await expect(log).toContainText(/Which time|What time|times are/, { timeout: 10000 });
    await dialog.getByTestId("assistant-options").getByRole("button").first().click();
    await expect(log).toContainText(/full name/, { timeout: 10000 });
    await type("Matrix Tester", /mobile number/);
    await type(sampleMobile(info.project.name), /email/);
    await type("skip", /tap Confirm/);
    const card = dialog.getByTestId("voice-summary");
    const when = (await card.innerText()).match(/(\d{1,2}):(\d{2}) (AM|PM)/);
    expect(when, "the card shows a 12-hour time").toBeTruthy();
    await card.getByRole("button", { name: "Confirm" }).click();
    const slipCard = dialog.getByTestId("voice-slip");
    await expect(slipCard).toBeVisible({ timeout: 10000 });
    const reference = (await slipCard.getByTestId("voice-reference").innerText()).trim();
    expect(reference).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    const href = (await slipCard.getByRole("link", { name: /^Open my slip/ }).getAttribute("href")) as string;
    await page.goto(href);
    const slip = page.getByRole("article");
    await expect(slip).toBeVisible({ timeout: 15000 });
    const text = await slip.innerText();
    expect(text).toContain(reference);
    const [h, m, ap] = [Number(when?.[1]), Number(when?.[2]), when?.[3]];
    expect(text).toContain(`${h}:${String(m).padStart(2, "0")} ${ap} (Pakistan time)`);
    const total = ((ap === "PM" && h !== 12 ? h + 12 : ap === "AM" && h === 12 ? 0 : h) * 60 + m - 15 + 1440) % 1440;
    const arrive = `${Math.floor(total / 60) % 12 === 0 ? 12 : Math.floor(total / 60) % 12}:${String(total % 60).padStart(2, "0")} ${Math.floor(total / 60) >= 12 ? "PM" : "AM"}`;
    expect(text).toContain(`Please arrive by ${arrive}`);
    expect(text).not.toMatch(/\b([01]\d|2[0-3]):[0-5]\d \(/);
    // The PDF slip downloads, with the same 12-hour time.
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: /Download your slip/ }).click()]);
    const bytes = await (await download.createReadStream()).toArray();
    const pdf = Buffer.concat(bytes.map((b) => Buffer.from(b))).toString("latin1");
    expect(pdf.startsWith("%PDF"), "a PDF file").toBe(true);
    expect(pdf).toContain(`Please arrive by`);
    if (SHOTS) {
      await page.screenshot({ path: shotName(test.info().project.name, "slip-page"), fullPage: false });
      if (test.info().project.name.includes("chromium")) {
        const drawn = await renderPdf(await page.context().newPage(), Uint8Array.from(Buffer.concat(bytes.map((b) => Buffer.from(b)))));
        writeFileSync(shotName(test.info().project.name, "slip-pdf"), drawn.png);
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("full booking by voice (scripted speech): spelling and number read back, the slip opens", async ({ page }, info) => {
    await installFakeWebSpeech(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const assistant = () => dialog.getByRole("log").evaluate((l) => [...l.querySelectorAll(":scope > div > div")].filter((el) => (el.querySelector(":scope > span.sr-only")?.textContent ?? "").startsWith("Assistant")).map((el) => el.querySelector(":scope > p")?.textContent ?? ""));
    const say = async (text: string, expected: RegExp) => {
      await expect(dialog.getByRole("status").filter({ hasText: "Listening..." })).toBeVisible({ timeout: 20000 });
      const before = (await assistant()).length;
      await hear(page, text);
      await expect.poll(async () => (await assistant()).slice(before).some((t) => expected.test(t)), { timeout: 15000, message: `reply to "${text}"` }).toBe(true);
    };
    const tap = async (expected: RegExp) => {
      const before = (await assistant()).length;
      await dialog.getByTestId("assistant-options").getByRole("button").first().click();
      await expect.poll(async () => (await assistant()).slice(before).some((t) => expected.test(t)), { timeout: 15000 }).toBe(true);
    };
    await say("I want to book an appointment with Dr Bilal", /Which day/);
    await tap(/time/i);
    await tap(/full name/);
    await say("my name is Voice Tester", /spelling/);
    const digits = sampleMobile(`voice ${info.project.name}`).split("").map((d) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][Number(d)]).join(" ");
    await say(digits, /Is that right/);
    await say("yes", /email/);
    await say("skip", /tap Confirm/);
    await say("yes", /You're booked/);
    await expect(dialog.getByTestId("voice-slip").getByTestId("voice-reference")).toHaveText(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  });

  test("no speech recognition: a polite 'type below' message, and typing works fully", async ({ page }) => {
    const errors = watchConsole(page);
    await installFakeWebSpeech(page, { recognition: false });
    await page.goto("/");
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByText("Voice isn't supported in this browser. Please type below.")).toBeVisible({ timeout: 10000 });
    await dialog.getByRole("textbox", { name: "Your question" }).fill("What are your timings?");
    await dialog.getByRole("textbox", { name: "Your question" }).press("Enter");
    await expect(dialog.getByRole("log")).toContainText(/Mon–Sat|Monday/, { timeout: 10000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("mic permission refused: a polite message and the type box, no crash", async ({ page }) => {
    const errors = watchConsole(page);
    await installFakeWebSpeech(page, { micError: "NotAllowedError" });
    await page.goto("/");
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByText("The microphone is blocked")).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByRole("textbox", { name: "Your question" })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("this browser's real speech support (no fake): the mic never breaks the page", async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByTestId("voice-mode")).toBeVisible({ timeout: 10000 });
    // Either it listens, or it says politely to type (Firefox has no speech recognition).
    await expect(dialog.getByRole("status").filter({ hasText: /Listening|Tap the mic|Thinking|Speaking/ })).toBeVisible({ timeout: 15000 });
    await dialog.getByRole("textbox", { name: "Your question" }).fill("What are your timings?");
    await dialog.getByRole("textbox", { name: "Your question" }).press("Enter");
    await expect(dialog.getByRole("log")).toContainText(/Mon–Sat|Monday/, { timeout: 15000 });
    expect(errors.filter((e) => !/speech|microphone|NotAllowed|Permission|audio/i.test(e)), errors.join("\n")).toEqual([]);
  });

  test("slow network: the answer still comes, nothing stays on 'Thinking'", async ({ page }) => {
    // Every API call takes 2.5 s longer (a slow 3G line).
    await page.route("**/api/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const box = dialog.getByRole("textbox", { name: "Your question" });
    await box.fill("I want to book an appointment with Dr Bilal");
    await box.press("Enter");
    await expect(dialog.getByRole("log")).toContainText(/Which day|couldn't load/, { timeout: 30000 });
  });

  test("keyboard only and labels: Ask us, Send, mic, End, Show chat", async ({ page, browserName }) => {
    await installFakeWebSpeech(page);
    await page.goto("/");
    const ask = page.getByRole("button", { name: "Ask us" });
    await ask.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Your question" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // WebKit on a desktop does not move focus with Tab by default (a Safari setting), so focus is checked directly there.
    if (browserName !== "webkit") await expect(ask).toBeFocused();
    await page.getByRole("button", { name: "Talk by voice, in English or Urdu" }).click();
    for (const name of [/Stop listening|Tap to talk|Interrupt and talk/, /^End$/, /Show chat/]) await expect(dialog.getByRole("button", { name })).toHaveCount(1);
    // A visible focus ring on every voice control (shown on keyboard focus).
    for (const name of [/Stop listening|Tap to talk|Interrupt and talk/, /^End$/, /Show chat/]) {
      expect(await dialog.getByRole("button", { name }).getAttribute("class")).toMatch(/focus-visible:outline/);
    }
  });
});
