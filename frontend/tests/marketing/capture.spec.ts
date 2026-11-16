// Gallery images and the demo video draft for the portfolio / Fiverr gig (owner 2026-11-15). Run with
// playwright.marketing.config.ts (see there). Everything shown is sample data from the mock API; the patient is
// "Sample Patient" with a made-up number, and the demo labels stay on screen.
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { hear, installFakeWebSpeech } from "../e2e/helpers/fake-web-speech";

const OUT = resolve(process.cwd(), "..", "docs", "marketing");
mkdirSync(OUT, { recursive: true });
const GALLERY = { width: 1280, height: 769 };
const VIDEO = { width: 1280, height: 720 };

const sleep = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Big, calm captions for the silent video: they survive page changes (kept in sessionStorage). */
async function installCaptions(page: Page) {
  await page.addInitScript(() => {
    const render = () => {
      const text = sessionStorage.getItem("__cap") ?? "";
      let el = document.getElementById("__cap");
      if (!text) {
        el?.remove();
        return;
      }
      if (!el) {
        el = document.createElement("div");
        el.id = "__cap";
        el.setAttribute("aria-hidden", "true");
        el.style.cssText =
          "position:fixed;left:24px;bottom:24px;max-width:430px;z-index:2147483647;pointer-events:none;padding:14px 20px;border-radius:14px;" +
          "background:rgba(11,31,58,.94);color:#fff;font:600 21px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);";
        document.body.appendChild(el);
      }
      el.textContent = text;
    };
    (window as unknown as { __cap: (t: string) => void }).__cap = (t: string) => {
      sessionStorage.setItem("__cap", t);
      render();
    };
    document.addEventListener("DOMContentLoaded", render);
  });
}
const caption = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __cap: (t: string) => void }).__cap(t), text);

const assistantCount = (log: Locator) =>
  log.evaluate((el) => [...el.querySelectorAll(":scope > div > div")].filter((n) => (n.querySelector(":scope > span.sr-only")?.textContent ?? "").startsWith("Assistant")).length);

/** Types like a person, sends, and waits for the assistant's next reply. */
async function typeAndSend(page: Page, dialog: Locator, text: string, slow: boolean) {
  const log = dialog.getByRole("log");
  const before = await assistantCount(log);
  const box = dialog.getByRole("textbox", { name: "Your question" });
  await box.click();
  await box.pressSequentially(text, { delay: slow ? 38 : 0 });
  if (slow) await sleep(page, 500);
  await box.press("Enter");
  await expect.poll(() => assistantCount(log), { timeout: 20000 }).toBeGreaterThan(before);
  await sleep(page, slow ? 2500 : 500);
}

async function clickFirstChoice(page: Page, dialog: Locator, slow: boolean) {
  const choice = dialog.getByTestId("assistant-options").getByRole("button").first();
  await choice.waitFor({ timeout: 15000 });
  if (slow) await sleep(page, 900);
  await choice.click();
  await sleep(page, slow ? 2300 : 600);
}

type Marks = { card?: (page: Page) => Promise<void>; slip?: (page: Page) => Promise<void> };

/** The typed English booking: allergy -> Dr. Maryam -> day -> time -> name -> phone -> skip email -> confirm -> slip. */
async function typedBooking(page: Page, slow: boolean, marks: Marks = {}): Promise<string> {
  const say = (text: string) => (slow ? caption(page, text) : Promise.resolve());
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ask us" })).toBeVisible();
  await say("Meet the Shuaib Health demo clinic");
  if (slow) await sleep(page, 3800);
  await say("Ask us: the AI receptionist answers from the clinic's own data");
  await page.getByRole("button", { name: "Ask us" }).click();
  const dialog = page.getByRole("dialog", { name: /Ask / });
  await expect(dialog).toBeVisible();
  if (slow) await sleep(page, 2200);
  await say("A patient describes what is wrong");
  await typeAndSend(page, dialog, "I have an allergy, can you treat it?", slow);
  await say("It suggests the right department and the doctor, with days, hours and fee");
  if (slow) await sleep(page, 2600);
  await typeAndSend(page, dialog, "yes please", slow);
  await say("One question at a time: the day...");
  await clickFirstChoice(page, dialog, slow);
  await say("...then a free time (real free slots, no double booking)");
  await clickFirstChoice(page, dialog, slow);
  await say("Name and mobile number");
  await typeAndSend(page, dialog, "Sample Patient", slow);
  await typeAndSend(page, dialog, "03001234567", slow);
  await say("The email is optional");
  await typeAndSend(page, dialog, "skip", slow);
  const card = dialog.getByTestId("voice-summary").or(dialog.getByRole("button", { name: "Confirm" }));
  await card.first().waitFor({ timeout: 15000 });
  await say("Everything is shown before anything is booked");
  if (slow) await sleep(page, 3200);
  await marks.card?.(page);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  const link = dialog.getByRole("link", { name: /Open my slip|Meri slip kholein/ });
  await link.waitFor({ timeout: 20000 });
  const href = (await link.getAttribute("href")) ?? "";
  await say("Booked: a reference and a slip");
  if (slow) await sleep(page, 2400);
  await page.goto(href);
  await expect(page.getByRole("button", { name: /Download your slip/ })).toBeVisible({ timeout: 15000 });
  await say("The slip: QR code, PDF, calendar file. Personal details are masked");
  if (slow) await sleep(page, 4200);
  await marks.slip?.(page);
  return href.split("/").at(-1) ?? "";
}

async function demoDashboard(page: Page, slow: boolean) {
  await page.goto("/");
  if (slow) await caption(page, "The clinic team's dashboard (demo, sample data only)");
  await page.getByTestId("announcement-bar").getByRole("button").click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("demo-ribbon")).toBeVisible();
  await sleep(page, slow ? 7000 : 1500);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: resolve(OUT, name), type: "png" });
}

async function newPage(browser: Browser, viewport: { width: number; height: number }, options: { video?: boolean; scale?: number; mobile?: boolean } = {}) {
  const context = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport,
    deviceScaleFactor: options.scale ?? 1,
    isMobile: options.mobile ?? false,
    hasTouch: options.mobile ?? false,
    ...(options.video ? { recordVideo: { dir: resolve(OUT, ".video-tmp"), size: viewport } } : {}),
  });
  return { context, page: await context.newPage() };
}

test.describe.configure({ timeout: 300_000 });

test("gallery: hero, booking card, slip, dashboard", async ({ browser }) => {
  const { context, page } = await newPage(browser, GALLERY);
  await page.goto("/");
  await expect(page.getByTestId("talk-to-ayesha")).toBeVisible();
  await sleep(page, 1200);
  await shot(page, "gig-1-home-hero.png");

  await typedBooking(page, false, {
    card: (p) => shot(p, "gig-3-booking-confirm-card.png"),
    slip: (p) => shot(p, "gig-4-appointment-slip.png"),
  });
  await demoDashboard(page, false);
  await shot(page, "gig-5-staff-dashboard-demo.png");
  await context.close();
});

test("gallery: the voice panel in the middle of a conversation", async ({ browser }) => {
  const { context, page } = await newPage(browser, GALLERY);
  await installFakeWebSpeech(page);
  await page.goto("/");
  await page.getByTestId("talk-to-ayesha").click();
  const dialog = page.getByRole("dialog", { name: /Ask / });
  const log = dialog.getByRole("log");
  const listening = dialog.getByRole("status").filter({ hasText: "Listening..." });
  for (const said of ["I have an allergy, can you treat it?", "yes please"]) {
    await expect(listening).toBeVisible({ timeout: 20000 });
    const before = await assistantCount(log);
    await hear(page, said);
    await expect.poll(() => assistantCount(log), { timeout: 20000 }).toBeGreaterThan(before);
  }
  await expect(listening).toBeVisible({ timeout: 20000 });
  await sleep(page, 800);
  await shot(page, "gig-2-voice-panel.png");
  await context.close();
});

test("gallery: the phone view", async ({ browser }) => {
  const { context, page } = await newPage(browser, { width: 390, height: 844 }, { scale: 2, mobile: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ask us" })).toBeVisible();
  await sleep(page, 1000);
  const phone = (await page.screenshot({ type: "png" })).toString("base64");
  await context.close();
  // The phone screenshot on a calm 1280 x 769 backdrop (no browser chrome).
  const { context: c2, page: p2 } = await newPage(browser, GALLERY);
  await p2.setContent(
    `<body style="margin:0;width:1280px;height:769px;display:flex;align-items:center;justify-content:center;gap:70px;background:linear-gradient(135deg,#0b1f3a 0%,#123a6b 55%,#0f766e 100%);font-family:Inter,system-ui,sans-serif;color:#fff">
      <div style="max-width:430px"><div style="font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#dcc28a">Mobile first</div>
      <div style="font-size:44px;font-weight:700;line-height:1.12;margin-top:12px">Made for the phone in every patient's hand</div>
      <div style="font-size:20px;line-height:1.45;margin-top:16px;color:rgba(255,255,255,.82)">Book in under a minute, by typing or by talking to the AI receptionist.</div></div>
      <img src="data:image/png;base64,${phone}" style="height:690px;border-radius:34px;border:10px solid #0b1f3a;box-shadow:0 30px 70px rgba(0,0,0,.45)" />
    </body>`,
  );
  await sleep(p2, 500);
  await shot(p2, "gig-6-mobile-view.png");
  await c2.close();
});

test("video draft: typed English booking, slip, demo dashboard (about 70 seconds, silent, with captions)", async ({ browser }) => {
  const { context, page } = await newPage(browser, VIDEO, { video: true });
  await installCaptions(page);
  const ref = await typedBooking(page, true);
  expect(ref).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  await demoDashboard(page, true);
  await caption(page, "Shuaib Health: a portfolio demo, not a real clinic");
  await sleep(page, 3600);
  const video = page.video();
  await context.close();
  await video?.saveAs(resolve(OUT, "demo-video-draft.webm"));
  rmSync(resolve(OUT, ".video-tmp"), { recursive: true, force: true });
});
