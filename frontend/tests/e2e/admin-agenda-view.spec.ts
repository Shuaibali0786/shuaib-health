import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, runUntilNewBookingToast, signIn } from "./admin-helpers";
import { expectNoClipping } from "./helpers/clipping";

// The agenda's Timeline / List switch (Feature 006, US5): the same bookings as chips on the timeline or as the
// collapsible doctor lists, chosen with a segmented control on wide screens. Phones always show the list.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const NOW = new Date(fixture.meta.now);
const total = fixture.overview.agenda.flatMap((row: { items: unknown[] }) => row.items).length as number;

async function openOverview(page: Page) {
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
  await page.goto("/admin");
  await revealStreamedContent(page);
  await expect(page.getByTestId("status-mix")).toBeVisible();
}

const drawer = (page: Page) => page.getByRole("dialog").filter({ has: page.locator(".dr-head") });

test.beforeEach(async ({ context, baseURL, isMobile }) => {
  test.skip(isMobile, "phones have no switch: they always show the list");
  await signIn(context, "demo", baseURL!);
});

test("starts as the timeline, with Timeline pressed", async ({ page }) => {
  await openOverview(page);
  const group = page.getByRole("group", { name: "Agenda view" });
  await expect(group.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".tl-b").first()).toBeVisible();
  await expect(page.locator("section.agenda").getByTestId("agenda-list")).toHaveCount(0);
});

test("List shows the same bookings as doctor lists, and Timeline brings the chips back", async ({ page }) => {
  await openOverview(page);
  const chips = await page.locator(".tl-b").count();
  expect(chips).toBe(total);

  await page.getByRole("button", { name: "List" }).click();
  const list = page.locator("section.agenda").getByTestId("agenda-list");
  await expect(list).toBeVisible();
  await expect(page.locator(".tl-b")).toHaveCount(0);
  await expect(page.locator("section.agenda .legend")).toHaveCount(0);
  // Every doctor is a collapsible panel; open them all and count the rows: the same bookings as the chips.
  const panels = list.locator("details.m-doc");
  for (let i = 0; i < (await panels.count()); i += 1) {
    if ((await panels.nth(i).getAttribute("open")) === null) await panels.nth(i).locator("summary").click();
  }
  await expect(list.locator("button.m-row")).toHaveCount(total);
  expect(await list.getByTestId("now-row").count()).toBeGreaterThan(0); // a "Now" line in each doctor who has a later booking
  await expectNoClipping(page, "agenda as a list");

  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.locator(".tl-b")).toHaveCount(total);
  await expect(list).toHaveCount(0);
});

test("a row in the list opens the booking, with the drawer returning focus to the row", async ({ page }) => {
  await openOverview(page);
  await page.getByRole("button", { name: "List" }).click();
  const row = page.locator("section.agenda button.m-row:visible").first();
  await row.click();
  await expect(drawer(page)).toContainText("Booking ");
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
  await expect(row).toBeFocused();
});

test("the choice survives the live refresh and a simulated booking, which then appears in the list too", async ({ page }) => {
  await openOverview(page);
  await page.getByRole("button", { name: "List" }).click();
  await runUntilNewBookingToast(page); // the demo simulates an online booking
  await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  const list = page.locator("section.agenda").getByTestId("agenda-list");
  const panels = list.locator("details.m-doc");
  for (let i = 0; i < (await panels.count()); i += 1) {
    if ((await panels.nth(i).getAttribute("open")) === null) await panels.nth(i).locator("summary").click();
  }
  await expect(list.locator("button.m-row")).toHaveCount(total + 1);
});
