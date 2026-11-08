// Feature 013: the voice receptionist in a real browser against the mock API (never production), with a scripted
// Web Speech API. The normal e2e build has VOICE_ENABLED unset (off): no bubble, no voice buttons.
// Run with the flags on: `ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test voice --workers=1`.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { hear, installFakeWebSpeech, spokenText } from "./helpers/fake-web-speech";

const truthy = (v: string | undefined) => ["true", "1", "yes", "on"].includes((v ?? "").toLowerCase());
const ON = truthy(process.env.ASSISTANT_ENABLED) && truthy(process.env.VOICE_ENABLED);
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openVoice(page: Page) {
  await page.goto("/");
  const bubble = page.getByRole("button", { name: /Talk to us/ });
  await expect(bubble).toBeVisible({ timeout: 8000 });
  await bubble.click();
  const dialog = page.getByRole("dialog", { name: /Ask / });
  await expect(dialog).toBeVisible();
  await expect(listening(dialog)).toBeVisible({ timeout: 8000 });
  return dialog;
}

const listening = (dialog: ReturnType<Page["getByRole"]>) => dialog.getByRole("status").filter({ hasText: "Listening..." });

async function say(page: Page, text: string, expected: string | RegExp) {
  await hear(page, text);
  await expect(page.getByRole("log")).toContainText(expected, { timeout: 8000 });
}

/** A real free day and time from the mock API (it follows its own clock), so the scripts never go stale. */
async function freeSlot(page: Page, doctor: string) {
  const slotsResponse = await page.request.get(`/api/booking/slots/${doctor}`);
  const slots = (await slotsResponse.json()) as { days: Array<{ date: string; status: string; slots: Array<{ localTime: string }> }> };
  const day = slots.days.find((d) => d.status === "available" && d.slots.length > 0);
  expect(day).toBeTruthy();
  return { dayNumber: Number((day?.date ?? "").slice(8, 10)), time: day?.slots[0]?.localTime ?? "10:00" };
}

test.describe("voice receptionist", () => {
  test("is absent when the flags are off (default)", async ({ page }) => {
    test.skip(ON, "flags are on in this run");
    const response = await page.goto("/");
    // The microphone stays blocked for everyone when voice is off.
    expect(response?.headers()["permissions-policy"] ?? "").toContain("microphone=()");
    await expect(page.getByRole("button", { name: /Talk to us/ })).toHaveCount(0);
    // With the flags off (the CI build) there is no chat button, so nothing voice-related can be reached.
    await expect(page.getByRole("button", { name: /voice mode|dictate/i })).toHaveCount(0);
    await page.waitForTimeout(1500); // longer than the bubble's delay: it must still not appear
    await expect(page.getByRole("button", { name: /Talk to us/ })).toHaveCount(0);
  });

  test("lets this site (and only this site) use the microphone: Permissions-Policy microphone=(self)", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const response = await page.goto("/");
    const policy = response?.headers()["permissions-policy"] ?? "";
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
  });

  test("welcomes briefly, listens by itself, answers by voice, and passes axe", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await expect(dialog.getByTestId("voice-orb")).toBeVisible();
    await expect(dialog.getByRole("log")).toContainText("Welcome to Shuaib Health! I'm your AI assistant. How can I help you today?");
    await expect(dialog.getByText(/audio is never recorded/)).toBeVisible();
    await say(page, "What are your timings?", /Mon–Sat/);
    await expect.poll(() => spokenText(page)).toContain("9 AM");
    const results = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("only one big mic button and End; both work by keyboard", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    for (const gone of ["Mute", "Interrupt", "EN", "اردو", "Female", "Male", "Hear a sample"]) {
      await expect(dialog.getByRole("button", { name: gone, exact: true })).toHaveCount(0);
    }
    await dialog.getByRole("button", { name: "Stop listening" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("status").filter({ hasText: "Tap the mic to talk" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(listening(dialog)).toBeVisible();
    await dialog.getByRole("button", { name: "End", exact: true }).click();
    await expect(dialog.getByTestId("voice-mode")).toHaveCount(0);
  });

  test("Edge's 'speech service not reachable' shows the Chrome / type notice, and typing works", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await page.evaluate(() => (window as unknown as { __fail: (e: string) => void }).__fail("network"));
    await expect(dialog.getByText("Voice listening works most reliably in the Chrome browser")).toBeVisible();
    await expect(dialog.getByText(/You can also type below/)).toBeVisible();
    await dialog.getByLabel("Your question").fill("timings");
    await dialog.getByLabel("Your question").press("Enter");
    await expect(dialog.getByRole("log")).toContainText("Mon–Sat");
  });

  test("a refused microphone request at the tap shows the Edge and Windows steps at once", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page, { micError: "NotAllowedError" });
    await page.goto("/");
    await page.getByRole("button", { name: /Talk to us/ }).click({ timeout: 8000 });
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByText("The microphone is blocked")).toBeVisible();
    await expect(dialog.getByText(/Cookies and site permissions/)).toBeVisible();
    await expect(dialog.getByText(/Privacy & security, then Microphone/)).toBeVisible();
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("Welcome to Shuaib Health");
    const results = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);
  });

  test("without speech recognition it speaks only and says to type", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page, { recognition: false });
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await dialog.getByRole("button", { name: /Start voice mode/ }).click();
    await expect(dialog.getByText("This browser can't listen")).toBeVisible();
    await dialog.getByLabel("Your question").fill("timings");
    await dialog.getByLabel("Your question").press("Enter");
    await expect(dialog.getByRole("log")).toContainText("Mon–Sat");
  });

  test("English booking by voice: one item at a time, read-back, spoken yes, card with the website slip link", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const { dayNumber, time } = await freeSlot(page, "dr-bilal-ansari");
    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /Which day/);
    await say(page, `the ${dayNumber}th`, /Which time/);
    await say(page, time, /full name/);
    await say(page, "my name is Sara Noor", /mobile number/);
    await say(page, "zero three one one one two three four five six seven", /email/);
    await say(page, "skip", /Shall I confirm/);

    const summary = dialog.getByTestId("voice-summary");
    await expect(summary).toContainText("Sara Noor");
    await expect(summary).toContainText("0311 123 4567");
    await expect(summary).toContainText("Waiting for your yes");
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("zero three one one, one two three, four five six seven");
    await expect(dialog.getByTestId("voice-slip")).toHaveCount(0); // nothing is booked before the yes
    const axe = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(axe.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

    // Say yes only once the read-back has been spoken to the end (a "yes" over the read-back never books).
    await expect(listening(dialog)).toBeVisible({ timeout: 15000 });
    await hear(page, "yes");
    const slip = dialog.getByTestId("voice-slip");
    await expect(slip).toBeVisible({ timeout: 10000 });
    await expect(slip.getByTestId("voice-reference")).toHaveText(/^[0-9A-Z]{4} [0-9A-Z]{4} [0-9A-Z]{2}$/);
    const link = slip.getByRole("link", { name: /View \/ Download slip/ });
    await expect(link).toHaveAttribute("href", /^\/book-appointment\/confirmed\//);
    await expect(link).toHaveAttribute("target", "_blank");
    // The link opens the SAME slip page the website form creates.
    const [slipPage] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await slipPage.waitForLoadState();
    await expect(slipPage.getByRole("button", { name: /Download your slip/ })).toBeVisible({ timeout: 15000 });
    await slipPage.close();
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toMatch(/Your reference is [0-9A-Z]/);
    await say(page, "book another appointment", /one booking per conversation/);
  });

  test("Roman Urdu booking by typing: CBC test -> explanation -> haan -> details -> ji haan -> slip link", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const lab = await page.request.get("/api/booking/slots/dr-zainab-memon");
    expect(lab.ok()).toBe(true);
    const { dayNumber, time } = await freeSlot(page, "dr-zainab-memon");
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const box = dialog.getByRole("textbox", { name: "Your question" });
    const type = async (text: string, expected: string | RegExp) => {
      await box.fill(text);
      await box.press("Enter");
      await expect(dialog.getByRole("log")).toContainText(expected, { timeout: 8000 });
    };
    await type("mujhe CBC test karwana hai", "Kya main aap ki booking kar doon?");
    await type("haan", "Kaun sa din");
    await type(`${dayNumber} tareekh`, "Kaun sa waqt");
    await type(time, "poora naam");
    await type("mera naam Ayesha Khan hai", "mobile number");
    await type("03005512345", "email");
    await type("nahi", "confirm kar doon");
    await type("ji haan", "Is link ko tap karein, slip download karein, aur clinic aate waqt saath laayein.");
    await expect(dialog.getByTestId("voice-slip").getByRole("link", { name: /Slip dekhein/ })).toHaveAttribute("href", /^\/book-appointment\/confirmed\//);
  });

  test("an emergency spoken mid-booking gives the number first and stops the booking", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /Which day/);
    await say(page, "my father has chest pain and cannot breathe", /Please call/);
    await expect(dialog.getByRole("log")).toContainText("1122");
    await hear(page, "yes");
    await expect(dialog.getByTestId("voice-slip")).toHaveCount(0);
  });

  test("reduced motion: the orb is still, and the panel fits the screen", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width <= viewport.width && box.height <= viewport.height).toBe(true);
    await expect(dialog.getByTestId("voice-orb")).toHaveAttribute("data-state", "listening");
    await page.goto("/");
    const animation = await page.getByRole("button", { name: /Talk to us/ }).evaluate((el) => getComputedStyle(el.parentElement as Element).animationName);
    expect(animation).toBe("none");
  });
});
