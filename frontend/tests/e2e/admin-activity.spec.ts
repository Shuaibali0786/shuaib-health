import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, signIn } from "./admin-helpers";

// Activity (Feature 006, US8, FR-030): newest first, filtered by event and by staff member, paged by 25, for admins
// only; the demo shows a synthetic feed. The mock API serves the demo day's synthetic events.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
type Event = { id: string; at: string; action: string; actorName?: string; networkTag: string };
const events: Event[] = fixture.activity;

const rows = (page: import("@playwright/test").Page) => page.locator(".activity-table tbody tr");

test.describe("Activity as an admin", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "admin", baseURL!));

  test("is newest first, 25 to a page, with a short network tag and no personal details", async ({ page }) => {
    await page.goto("/admin/activity");
    await revealStreamedContent(page);
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
    await expect(rows(page)).toHaveCount(25);
    const stamps = await rows(page).locator("time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime")!));
    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(stamps[0]).toBe(events[0]!.at);
    await expect(page.getByTestId("page-count")).toHaveText(`Showing 1–25 of ${events.length} events`);
    for (const tag of await rows(page).locator(".tag").allTextContents()) expect(tag).toMatch(/^[0-9a-f]{6}$/);
    const text = (await page.locator(".activity-table").innerText()).toLowerCase();
    for (const secret of ["password", "@", "+92"]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/0d{3}[ -]?d{7}/); // no phone number
  });

  test("filters by event and by staff member, and clears", async ({ page, context, baseURL }) => {
    // The demo's staff list is the one the synthetic events are about.
    await context.clearCookies();
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/activity");
    await page.getByLabel("Event").selectOption("booking.phone_revealed");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/action=booking\.phone_revealed/);
    const reveals = events.filter((e) => e.action === "booking.phone_revealed");
    await expect(rows(page)).toHaveCount(Math.min(25, reveals.length));
    for (const action of await rows(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-action")))) expect(action).toBe("booking.phone_revealed");

    const who = reveals[0]!.actorName!;
    await page.getByLabel("Staff member").selectOption({ label: who });
    await page.getByRole("button", { name: "Apply" }).click();
    const mine = reveals.filter((e) => e.actorName === who);
    await expect(rows(page)).toHaveCount(Math.min(25, mine.length));
    await expect(page.getByTestId("page-count")).toContainText(`of ${mine.length} events`);
    for (const name of await rows(page).locator(".who-cell b").allTextContents()) expect(name).toBe(who);

    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/admin\/activity$/);
    await expect(rows(page)).toHaveCount(25);
  });

  test("pages with links, and the filters survive a page change", async ({ page }) => {
    await page.goto("/admin/activity");
    const firstPage = await rows(page).locator("time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime")));
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2$/);
    await expect(page.getByTestId("page-count")).toHaveText(`Showing 26–50 of ${events.length} events`);
    const secondPage = await rows(page).locator("time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime")));
    expect(secondPage.every((at) => !firstPage.includes(at))).toBe(true);
    expect(secondPage[0]! <= firstPage[24]!).toBe(true);
    await page.getByRole("link", { name: "Previous page" }).click();
    await expect(page.getByTestId("page-count")).toHaveText(`Showing 1–25 of ${events.length} events`);
  });

  test("shows a calm message when nothing matches", async ({ page }) => {
    await page.goto("/admin/activity?action=staff.role_changed");
    await expect(page.getByRole("heading", { name: "No activity matches" })).toBeVisible();
  });

  test("is in the admin navigation", async ({ page, isMobile }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible"));
    if (!isMobile) await expect(nav.getByRole("link", { name: "Activity" })).toBeVisible();
  });
});

test.describe("Activity for others", () => {
  test("a receptionist has no link to it and is refused at the address", async ({ context, page, baseURL, isMobile }) => {
    await signIn(context, "receptionist", baseURL!);
    await page.goto("/admin");
    if (!isMobile) await expect(page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible")).getByRole("link", { name: "Activity" })).toHaveCount(0);
    const answer = await page.request.get("/api/admin/activity");
    expect(answer.status()).toBe(403);
    await page.goto("/admin/activity");
    await expect(page.getByRole("heading", { name: "You do not have access to this page" })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  test("the demo sees the synthetic feed, marked as sample data", async ({ context, page, baseURL }) => {
    await signIn(context, "demo", baseURL!);
    await page.goto("/admin/activity");
    await expect(rows(page)).toHaveCount(25);
    await expect(page.getByTestId("page-count")).toContainText("(sample data)");
    const names = await rows(page).locator(".who-cell b").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => events.some((e) => e.actorName === name))).toBe(true);
  });
});
