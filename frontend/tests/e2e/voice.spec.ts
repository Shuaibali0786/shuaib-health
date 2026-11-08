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
  await expect(dialog.getByText("Listening…")).toBeVisible({ timeout: 8000 });
  return dialog;
}

async function say(page: Page, text: string, expected: string | RegExp) {
  await hear(page, text);
  await expect(page.getByRole("log")).toContainText(expected, { timeout: 8000 });
}

test.describe("voice receptionist", () => {
  test("is absent when the flags are off (default)", async ({ page }) => {
    test.skip(ON, "flags are on in this run");
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Talk to us/ })).toHaveCount(0);
    // With the flags off (the CI build) there is no chat button, so nothing voice-related can be reached.
    await expect(page.getByRole("button", { name: /voice mode|dictate/i })).toHaveCount(0);
    await page.waitForTimeout(1500); // longer than the bubble's delay: it must still not appear
    await expect(page.getByRole("button", { name: /Talk to us/ })).toHaveCount(0);
  });

  test("answers by voice, shows captions and controls, and passes axe", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await expect(dialog.getByTestId("voice-orb")).toBeVisible();
    await expect(dialog.getByRole("log")).toContainText("I'm an AI");
    await expect(dialog.getByRole("log")).toContainText("never record or store your audio");

    await say(page, "What are your timings?", /Mon–Sat/);
    expect(await spokenText(page)).toContain("9 AM");

    const results = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("every control is reachable by keyboard and has a name", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    for (const name of ["Mute", "Interrupt", "EN", "اردو", "Female", "Male", "End"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Mute", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("Microphone muted")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("Listening…")).toBeVisible();
    await dialog.getByRole("button", { name: "اردو", exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { __srLang: string }).__srLang)).toBe("ur-PK");
    await dialog.getByRole("button", { name: "End", exact: true }).click();
    await expect(dialog.getByTestId("voice-mode")).toHaveCount(0);
  });

  test("explains a blocked microphone and keeps the text box working", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await page.evaluate(() => (window as unknown as { __fail: (e: string) => void }).__fail("not-allowed"));
    await expect(dialog.getByText("The microphone is blocked")).toBeVisible();
    await dialog.getByLabel("Your question").fill("cbc price");
    await dialog.getByLabel("Your question").press("Enter");
    await expect(dialog.getByRole("log")).toContainText("PKR 800");
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

  test("books an appointment by voice: summary card, read-back, spoken yes, slip with QR and PDF", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    // Pick a real free time from the mock API (it follows today's date), so the script never goes stale.
    const slotsResponse = await page.request.get("/api/booking/slots/dr-bilal-ansari");
    const slots = (await slotsResponse.json()) as { days: Array<{ date: string; status: string; slots: Array<{ localTime: string }> }> };
    const day = slots.days.find((d) => d.status === "available" && d.slots.length > 0);
    expect(day).toBeTruthy();
    const dayNumber = Number((day?.date ?? "").slice(8, 10));
    const time = day?.slots[0]?.localTime ?? "10:00";

    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /full name/);
    await say(page, "my name is Sara Noor", /mobile number/);
    await say(page, "zero three one one one two three four five six seven", /visit for/);
    await say(page, "toothache", /Which day/);
    await say(page, `the ${dayNumber}th`, /Which time/);
    await say(page, time, /email/);
    await say(page, "skip", /Shall I confirm/);

    const summary = dialog.getByTestId("voice-summary");
    await expect(summary).toContainText("Sara Noor");
    await expect(summary).toContainText("0311 123 4567");
    await expect(summary).toContainText("Waiting for your yes");
    // The phone is read digit by digit (speech is sentence by sentence, so wait for it).
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("zero three one one, one two three, four five six seven");
    await expect(dialog.getByTestId("voice-slip")).toHaveCount(0); // nothing is booked before the yes

    const axe = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(axe.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

    await hear(page, "yes");
    const slip = dialog.getByTestId("voice-slip");
    await expect(slip).toBeVisible({ timeout: 10000 });
    await expect(slip.getByTestId("voice-reference")).toHaveText(/^[0-9A-Z]{4} [0-9A-Z]{4} [0-9A-Z]{2}$/);
    await expect(slip.getByRole("img", { name: /QR code for booking reference/ })).toBeVisible();
    await expect(slip).toContainText("15 minutes early");
    const download = page.waitForEvent("download", { timeout: 15000 });
    await slip.getByRole("button", { name: "Download PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toMatch(/Your reference is 7|Your reference is [0-9A-Z]/);

    // A second booking in the same conversation is refused.
    await say(page, "book another appointment", /one booking per conversation/);
  });

  test("an emergency spoken mid-booking gives the number first and stops the booking", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /full name/);
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
    // The discovery bubble does not animate.
    await page.goto("/");
    const animation = await page.getByRole("button", { name: /Talk to us/ }).evaluate((el) => getComputedStyle(el.parentElement as Element).animationName);
    expect(animation).toBe("none");
  });
});
