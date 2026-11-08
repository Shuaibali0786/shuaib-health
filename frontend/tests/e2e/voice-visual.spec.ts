// Feature 013: visual baselines for the voice panel (new screens only; no existing baseline changes).
// Reduced motion is on, so the orb and bubble are still and every frame is the same. Like the other visual
// specs, this runs only with the voice flags on: `ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test voice-visual`.
import { expect, test, type Page } from "@playwright/test";

import { hear, installFakeWebSpeech } from "./helpers/fake-web-speech";

const truthy = (v: string | undefined) => ["true", "1", "yes", "on"].includes((v ?? "").toLowerCase());
const ON = truthy(process.env.ASSISTANT_ENABLED) && truthy(process.env.VOICE_ENABLED);

async function openVoice(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Talk to us/ }).click({ timeout: 8000 });
  const dialog = page.getByRole("dialog", { name: /Ask / });
  await expect(dialog.getByText("Listening...")).toBeVisible({ timeout: 8000 });
  return dialog;
}

test.describe("voice panel visuals", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ON, "run with ASSISTANT_ENABLED=true VOICE_ENABLED=true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installFakeWebSpeech(page);
  });

  test("the discovery bubble above Ask us", async ({ page }) => {
    await page.goto("/");
    const bubble = page.getByRole("button", { name: /Talk to us/ });
    await expect(bubble).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".voice-bubble")).toHaveScreenshot("bubble.png", { animations: "disabled" });
  });

  test("voice mode, listening", async ({ page }) => {
    const dialog = await openVoice(page);
    await expect(dialog).toHaveScreenshot("panel-listening.png", { animations: "disabled", mask: [dialog.getByRole("log")] });
  });

  test("voice mode, booking summary and slip", async ({ page }) => {
    const dialog = await openVoice(page);
    const log = page.getByRole("log");
    const say = async (text: string, expected: string | RegExp) => {
      await hear(page, text);
      await expect(log).toContainText(expected, { timeout: 8000 });
    };
    await say("I want to book an appointment with Dr Bilal", /Which day/);
    await say("tomorrow", /Which time/);
    await expect(dialog.getByTestId("voice-summary")).toBeVisible();
    await expect(dialog.getByTestId("voice-summary")).toHaveScreenshot("summary-partial.png", { animations: "disabled" });
  });
});
