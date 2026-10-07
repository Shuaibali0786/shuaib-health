import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, signIn } from "./admin-helpers";

// Doctors today (Feature 006, US7, FR-029): the doctors in today as cards with their booked and free slots, the others
// folded away, and the holiday state.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
type Working = { doctor: { name: string }; scheduled: number; booked: number; free: number; freePassed?: number; utilisationPct: number; nextFree?: string | null };
const today = fixture.doctorsToday as { working: Working[]; notIn: { name: string }[]; onLeave: { name: string }[] };

test.describe("Doctors today", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("each doctor in today is a card with the numbers of the day", async ({ page }) => {
    await page.goto("/admin/doctors");
    await revealStreamedContent(page);
    await expect(page.getByRole("heading", { level: 1, name: "Doctors today" })).toBeVisible();
    const cards = page.locator("article.doc-card");
    await expect(cards).toHaveCount(today.working.length);
    // In the order the API gives: whoever has a slot free soonest first.
    await expect(cards.locator("h3")).toHaveText(today.working.map((w) => w.doctor.name));

    for (const entry of today.working) {
      const card = page.locator(`article[data-doctor="${entry.doctor.name}"]`);
      const stats = card.locator(".doc-stats dd");
      await expect(stats).toHaveText([String(entry.booked), String(entry.free), String(entry.scheduled)]);
      await expect(card.locator(".util .pct")).toHaveText(`${entry.utilisationPct}%`);
      if (entry.nextFree) await expect(card.locator(".next-free")).toContainText(`Next free ${entry.nextFree}`);
      if (entry.freePassed) await expect(card.locator(".next-free")).toContainText(`${entry.freePassed} free ${entry.freePassed === 1 ? "slot" : "slots"} passed`);
      await expect(card.locator(".util")).toHaveAttribute("aria-label", new RegExp(`${entry.booked} of ${entry.scheduled} slots booked`));
    }
  });

  test("Not in today is collapsed until it is opened", async ({ page }) => {
    await page.goto("/admin/doctors");
    const folded = page.getByTestId("not-in-today");
    await expect(folded).toBeVisible();
    expect(await folded.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(folded.getByText(today.notIn[0]!.name)).toBeHidden();
    await folded.getByText("Not in today").click();
    for (const doctor of today.notIn) await expect(folded.getByText(doctor.name)).toBeVisible();
  });
});

test("a clinic holiday says Clinic closed today and names it", async ({ context, page, baseURL }) => {
  await signIn(context, "closed", baseURL!);
  await page.goto("/admin/doctors");
  await expect(page.getByRole("heading", { name: "Clinic closed today" })).toBeVisible();
  await expect(page.getByText("Founders Day")).toBeVisible();
  await expect(page.locator("article.doc-card")).toHaveCount(0);
});
