// Feature 013: the voice receptionist in a real browser against the mock API (never production), with a scripted
// Web Speech API. The normal e2e build has VOICE_ENABLED unset (off): no bubble, no voice buttons.
// Run with the flags on: `ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test voice --workers=1`.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { hear, installFakeWebSpeech, spokenText } from "./helpers/fake-web-speech";

const truthy = (v: string | undefined) => ["true", "1", "yes", "on"].includes((v ?? "").toLowerCase());
const ON = truthy(process.env.ASSISTANT_ENABLED) && truthy(process.env.VOICE_ENABLED);
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The round mic inside the one "Ask us" button (owner decision 2026-11-08: no separate "Talk to us" bubble). */
const micButton = (page: Page) => page.getByRole("button", { name: "Talk by voice, in English or Urdu" });

async function openVoice(page: Page) {
  await page.goto("/");
  await expect(micButton(page)).toBeVisible({ timeout: 8000 });
  await micButton(page).click();
  const dialog = page.getByRole("dialog", { name: /Ask / });
  await expect(dialog).toBeVisible();
  await expect(listening(dialog)).toBeVisible({ timeout: 8000 });
  return dialog;
}

const listening = (dialog: ReturnType<Page["getByRole"]>) => dialog.getByRole("status").filter({ hasText: "Listening..." });

/** The assistant messages in the chat, oldest first (the cards and choices in the log are not messages). */
const assistantMessages = (page: Page) =>
  page.getByRole("log").evaluate((log) =>
    [...log.querySelectorAll(":scope > div > div")]
      .filter((el) => (el.querySelector(":scope > span.sr-only")?.textContent ?? "").startsWith("Assistant"))
      .map((el) => el.querySelector(":scope > p")?.textContent ?? ""),
  );

/**
 * Waits for a NEW assistant reply that matches. Matching the whole log was flaky: "mobile number" or "Confirm dabaiye"
 * were already there from earlier turns, so the next line was "said" while the assistant was still thinking or
 * speaking (the mic is closed then) and was lost.
 */
async function expectNewReply(page: Page, before: number, expected: string | RegExp) {
  const matches = (t: string) => (typeof expected === "string" ? t.includes(expected) : expected.test(t));
  await expect
    .poll(async () => (await assistantMessages(page)).slice(before).some(matches), { timeout: 15000, message: `a new reply matching ${String(expected)}` })
    .toBe(true);
}

async function say(page: Page, text: string, expected: string | RegExp) {
  // The mic is closed while the assistant speaks: answer once it is listening again, like a patient would.
  await expect(page.getByRole("status").filter({ hasText: "Listening..." })).toBeVisible({ timeout: 20000 });
  const before = (await assistantMessages(page)).length;
  await hear(page, text);
  await expectNewReply(page, before, expected);
}

/** A real free day and time from the mock API (it follows its own clock), so the scripts never go stale. */
async function freeSlot(page: Page, doctor: string) {
  const slotsResponse = await page.request.get(`/api/booking/slots/${doctor}`);
  const slots = (await slotsResponse.json()) as { days: Array<{ date: string; status: string; slots: Array<{ localTime: string }> }> };
  const day = slots.days.find((d) => d.status === "available" && d.slots.length > 0);
  expect(day).toBeTruthy();
  return { dayNumber: Number((day?.date ?? "").slice(8, 10)), time: day?.slots[0]?.localTime ?? "10:00" };
}

/** Collects page errors and console errors, so every flow can prove it ran clean. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** After a turn the panel must settle: never stuck on "Thinking..." or "Speaking...". */
async function expectSettled(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.getByRole("status").filter({ hasText: /Thinking|Speaking/ })).toHaveCount(0, { timeout: 20000 });
}

/** The conversation still works after the booking: a question is answered, End leaves voice mode cleanly. */
async function finishCleanly(page: Page, dialog: ReturnType<Page["getByRole"]>, errors: string[]) {
  await expectSettled(dialog);
  await say(page, "What are your timings?", /Mon–Sat|Monday to Saturday|khula hai/);
  await expectSettled(dialog);
  await dialog.getByRole("button", { name: "End", exact: true }).click();
  await expect(dialog.getByTestId("voice-mode")).toHaveCount(0);
  expect(errors).toEqual([]);
}

test.describe("voice receptionist", () => {
  // Each turn now waits for the real reply and for the mic to open again, so a full booking takes longer than 30 s.
  test.describe.configure({ timeout: 120_000 });
  test("is absent when the flags are off (default)", async ({ page }) => {
    test.skip(ON, "flags are on in this run");
    const response = await page.goto("/");
    // The microphone stays blocked for everyone when voice is off.
    expect(response?.headers()["permissions-policy"] ?? "").toContain("microphone=()");
    await expect(page.getByRole("button", { name: /Talk to us|Talk by voice/ })).toHaveCount(0);
    // With the flags off (the CI build) there is no chat button, so nothing voice-related can be reached.
    await expect(page.getByRole("button", { name: /voice mode|dictate/i })).toHaveCount(0);
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
    await expect(dialog.getByRole("log")).toContainText("Hello, welcome to Shuaib Health. I'm Ayesha, the clinic's assistant. I can help you in English or Urdu. How can I help you today?");
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
    await micButton(page).click({ timeout: 8000 });
    const dialog = page.getByRole("dialog", { name: /Ask / });
    await expect(dialog.getByText("The microphone is blocked")).toBeVisible();
    await expect(dialog.getByText(/Cookies and site permissions/)).toBeVisible();
    await expect(dialog.getByText(/Privacy & security, then Microphone/)).toBeVisible();
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("welcome to Shoo-aib Health");
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
    await expect(dialog.getByText("Voice isn't supported in this browser. Please type below.")).toBeVisible();
    await dialog.getByLabel("Your question").fill("timings");
    await dialog.getByLabel("Your question").press("Enter");
    await expect(dialog.getByRole("log")).toContainText("Mon–Sat");
  });

  // --- The three full flows (Chromium, the Chrome engine): no dead ends, no errors, no stuck states --------------------

  const OPEN_SLIP = /^(Open my slip|Meri slip kholein)/;

  test("FLOW 1, English by voice: doctor, day, time, name, mobile, email, the card, a spoken yes, Open my slip", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const errors = watchErrors(page);
    await installFakeWebSpeech(page);
    const { dayNumber, time } = await freeSlot(page, "dr-bilal-ansari");
    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /Which day/);
    await say(page, `the ${dayNumber}th`, /Which time/);
    await say(page, time, /full name/);
    await say(page, "my name is Sara Noor", /Sara Noor\. Is the spelling right\?/);
    await say(page, "yes", /mobile number/);
    await say(page, "zero three one one one two three four five six seven", /0311 123 4567\. Is that right\?/);
    await say(page, "yes", /email/);
    await say(page, "skip", /Please check the card, then say yes or tap Confirm/);

    const card = dialog.getByTestId("voice-summary");
    await expect(card).toContainText("Sara Noor");
    await expect(card).toContainText("0311 123 4567");
    await expect(card).toContainText("Dr. Bilal Ansari");
    await expect(card.getByRole("button", { name: "Confirm" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Change" })).toBeVisible();
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("Please check these details");
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toContain("zero three one one, one two three, four five six seven");
    await expect(dialog.getByTestId("voice-slip")).toHaveCount(0); // nothing is booked before the yes
    const axe = await new AxeBuilder({ page }).include("[role='dialog']").withTags(WCAG).analyze();
    expect(axe.violations.map((v) => `${v.id} on ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);

    // Say yes only once the details have been read to the end (a "yes" over them never books).
    await expect(listening(dialog)).toBeVisible({ timeout: 15000 });
    await hear(page, "yes");
    const slip = dialog.getByTestId("voice-slip");
    await expect(slip).toBeVisible({ timeout: 10000 });
    await expect(slip.getByTestId("voice-reference")).toHaveText(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    const link = slip.getByRole("link", { name: OPEN_SLIP });
    await expect(link).toHaveAttribute("href", /^\/book-appointment\/confirmed\/[^?]+$/);
    // The button opens the SAME slip page the website form creates.
    const [slipPage] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await slipPage.waitForLoadState();
    await expect(slipPage.getByRole("button", { name: /Download your slip/ })).toBeVisible({ timeout: 15000 });
    await expect(slipPage.getByText("Dr. Bilal Ansari").first()).toBeVisible();
    await slipPage.close();
    await expect.poll(() => spokenText(page), { timeout: 10000 }).toMatch(/Your reference is [0-9A-Z]/);
    await say(page, "book another appointment", /one booking per conversation/);
    await finishCleanly(page, dialog, errors);
  });

  test("FLOW 2, Roman Urdu: CBC test explained, offer, haan, details, the card with the TEST and its price, tap Confirm, Meri slip kholein", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const errors = watchErrors(page);
    await installFakeWebSpeech(page);
    const { dayNumber, time } = await freeSlot(page, "dr-zainab-memon");
    const dialog = await openVoice(page);
    // The owner's own words: a test named with a booking request goes straight to the lab booking (no doctor question).
    await say(page, "hay Mujhe CBC ki test karwani Kya Meri booking kar sakti ho", /Kaun sa din/);
    await expect(dialog.getByRole("log")).toContainText("Pathology Lab");
    await expect(dialog.getByRole("log")).not.toContainText("kis doctor");
    await say(page, `${dayNumber} tareekh`, /Kaun sa waqt/);
    await say(page, time, /poora naam/);
    await say(page, "mera naam Ayesha Khan hai", /Spelling theek hai/);
    await say(page, "haan", /mobile number/);
    await say(page, "sifar teen sifar sifar double paanch ek do teen char paanch", /0300 551 2345\. Sahi hai\?/);
    await say(page, "haan", /email/);
    await say(page, "nahi", /Confirm dabaiye/);

    const card = dialog.getByTestId("voice-summary");
    await expect(card).toContainText("Complete Blood Count (CBC) - PKR 800 (sample)");
    await expect(card).toContainText("0300 551 2345");
    await expect(card).not.toContainText("PKR 1,500");
    await expect(card.getByRole("button", { name: "Confirm" })).toBeVisible();
    // Voice and tap both work: this time the patient taps Confirm.
    await card.getByRole("button", { name: "Confirm" }).click();
    const slip = dialog.getByTestId("voice-slip");
    await expect(slip).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByRole("log")).toContainText("slip download karein aur reception par dikha dein.");
    await expect(slip.getByTestId("voice-booked-test")).toContainText("Complete Blood Count (CBC) - PKR 800 (sample)");
    const link = slip.getByRole("link", { name: OPEN_SLIP });
    await expect(link).toHaveAttribute("href", /\?test=complete-blood-count$/);
    // The slip page shows the TEST and its price (and the PDF too), not the doctor's visit fee.
    const [slipPage] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await slipPage.waitForLoadState();
    await expect(slipPage.getByRole("button", { name: /Download your slip/ })).toBeVisible({ timeout: 15000 });
    const slipCard = slipPage.getByRole("article");
    await expect(slipCard).toContainText("Complete Blood Count");
    await expect(slipCard).toContainText("PKR 800 (sample)");
    await expect(slipCard).not.toContainText("Fee");
    await slipPage.close();
    await finishCleanly(page, dialog, errors);
  });

  test("FLOW 3, a correction mid-way: spoken 'number ghalat hai', then Change on one item; each fixes only that item and shows the card again", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const errors = watchErrors(page);
    await installFakeWebSpeech(page);
    const { dayNumber, time } = await freeSlot(page, "dr-bilal-ansari");
    const dialog = await openVoice(page);
    await say(page, "Dr Bilal se appointment chahiye", /Kaun sa din/);
    await say(page, `${dayNumber} tareekh`, /Kaun sa waqt/);
    await say(page, time, /poora naam/);
    await say(page, "mera naam Ali Raza hai", /Spelling theek hai/);
    await say(page, "ji sahi hai", /mobile number/);
    await say(page, "zero three zero zero one two three four five six seven", /Sahi hai\?/);
    await say(page, "haan", /email/);
    await say(page, "skip", /Confirm dabaiye/);
    const card = dialog.getByTestId("voice-summary");
    await expect(card).toContainText("0300 123 4567");

    // 1) A spoken correction: only the number is asked again, then the card is shown again with the new number.
    await expect(listening(dialog)).toBeVisible({ timeout: 15000 });
    await say(page, "number ghalat hai", /mobile number/);
    await say(page, "zero three two one one two three four five six seven", /0321 123 4567\. Sahi hai\?/);
    await say(page, "haan", /Confirm dabaiye/);
    await expect(card).toContainText("0321 123 4567");
    await expect(card).toContainText("Ali Raza");

    // 2) Change by tapping: pick the name only.
    await card.getByRole("button", { name: "Change" }).click();
    const beforeTap = (await assistantMessages(page)).length;
    await card.getByRole("button", { name: "Naam" }).click();
    await expectNewReply(page, beforeTap, /poora naam|naam bata dein|kis naam/);
    await say(page, "mera naam Ali Hassan hai", /Spelling theek hai/);
    await say(page, "haan", /Confirm dabaiye/);
    await expect(card).toContainText("Ali Hassan");
    await expect(card).toContainText("0321 123 4567");
    await expect(dialog.getByTestId("voice-slip")).toHaveCount(0); // still nothing booked

    await expect(listening(dialog)).toBeVisible({ timeout: 15000 });
    await hear(page, "haan");
    await expect(dialog.getByTestId("voice-slip")).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByTestId("voice-slip").getByRole("link", { name: OPEN_SLIP })).toBeVisible();
    await finishCleanly(page, dialog, errors);
  });

  test("typing books too, and a 'never mind' ends the booking cleanly (no dead end)", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const errors = watchErrors(page);
    const { dayNumber, time } = await freeSlot(page, "dr-bilal-ansari");
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const box = dialog.getByRole("textbox", { name: "Your question" });
    const type = async (text: string, expected: string | RegExp) => {
      await box.fill(text);
      await box.press("Enter");
      await expect(dialog.getByRole("log")).toContainText(expected, { timeout: 8000 });
    };
    await type("I want to book an appointment with Dr Bilal", /Which day/);
    await type("never mind", /I've stopped the booking/);
    await expect(dialog.getByTestId("voice-summary")).toHaveCount(0);
    await type("I want to book an appointment with Dr Bilal", /Which day/);
    await type(`${dayNumber}th`, /Which time/);
    await type(time, /full name/);
    await type("Sara Noor", /mobile/);
    await type("03111234567", /email/);
    await type("skip", /tap Confirm/);
    await dialog.getByTestId("voice-summary").getByRole("button", { name: "Confirm" }).click();
    await expect(dialog.getByTestId("voice-slip")).toBeVisible({ timeout: 10000 });
    expect(errors).toEqual([]);
  });

  test("FLOW 4, Roman Urdu typed with the owner's own messages: test karwani, bllod ki, haan, tap a day and a time, phone + email in one sentence, Confirm, slip", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    const errors = watchErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Ask us" }).click();
    const dialog = page.getByRole("dialog", { name: /Ask / });
    const box = dialog.getByRole("textbox", { name: "Your question" });
    const log = dialog.getByRole("log");
    const type = async (text: string, expected: string | RegExp) => {
      await box.fill(text);
      await box.press("Enter");
      await expect(log).toContainText(expected, { timeout: 8000 });
    };
    await type("mujhy test karwani hia", "Kaun sa test karwana hai");
    await type("bllod ki", "Kya main aap ki booking kar doon?");
    await type("haan", "Kaun sa din");
    const choices = dialog.getByTestId("assistant-options");
    await choices.getByRole("button").first().click();
    await expect(log).toContainText("Kaun sa waqt", { timeout: 8000 });
    await dialog.getByTestId("assistant-options").getByRole("button").first().click();
    await expect(log).toContainText("poora naam", { timeout: 8000 });
    await type("Ayesha Khan", "mobile number");
    await type("Mera phone number 0324 5211332 aur email share@gmail.com hai", "Confirm dabaiye");
    const card = dialog.getByTestId("voice-summary");
    await expect(card).toContainText("0324 521 1332");
    await expect(card).toContainText("share@gmail.com");
    await expect(card).toContainText("Complete Blood Count (CBC) - PKR 800 (sample)");
    await expect(log).not.toContainText("Sample Road");
    await card.getByRole("button", { name: "Confirm" }).click();
    const slip = dialog.getByTestId("voice-slip");
    await expect(slip).toBeVisible({ timeout: 10000 });
    await expect(log).toContainText("slip download karein aur reception par dikha dein.");
    const link = slip.getByRole("link", { name: OPEN_SLIP });
    const [slipPage] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await slipPage.waitForLoadState();
    await expect(slipPage.getByRole("button", { name: /Download your slip/ })).toBeVisible({ timeout: 15000 });
    await expect(slipPage.getByRole("article")).toContainText("PKR 800 (sample)");
    await slipPage.close();
    expect(errors).toEqual([]);
  });

  test("an emergency spoken mid-booking gives the number first and stops the booking", async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await installFakeWebSpeech(page);
    const dialog = await openVoice(page);
    await say(page, "I want to book an appointment with Dr Bilal", /Which day/);
    await say(page, "my father has chest pain and cannot breathe", /Please call/);
    await expect(dialog.getByRole("log")).toContainText("1122");
    await expect(listening(dialog)).toBeVisible({ timeout: 15000 });
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
    // The mic's glow and the hero cards' float are both still with reduced motion.
    expect(await micButton(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await page.locator(".hero-float").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("the hero fact cards never sit under the Ask us button, and float gently with motion allowed", async ({ page, isMobile }) => {
    test.skip(!ON || isMobile, "desktop layout, flags on");
    await page.goto("/");
    // From 1280 px "Ask us" is two round buttons beside the page (owner B1): the buttons themselves must be clear.
    const dock = await page.locator(".assistant-dock > div").boundingBox();
    const cards = page.locator(".hero-float");
    expect(await cards.count()).toBe(3);
    for (let i = 0; i < 3; i += 1) {
      const card = await cards.nth(i).boundingBox();
      const overlaps = dock && card && card.x < dock.x + dock.width && card.x + card.width > dock.x && card.y < dock.y + dock.height && card.y + card.height > dock.y;
      expect(overlaps, `card ${i + 1}`).toBeFalsy();
    }
    expect(await cards.first().evaluate((el) => getComputedStyle(el).animationName)).toBe("hero-float");
  });
});
