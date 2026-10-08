import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { revealStreamedContent, signIn } from "./admin-helpers";

// Insights (Feature 006, US6, FR-028): each chart shows the figures of the mock API's demo day, in words and in a
// table; the range is in the address; the marks can be reached by keyboard; too little data is a calm empty state.

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
type Insights = { total: number; perDay: { date: string; count: number }[]; byDepartment: { departmentName: string; count: number; cancelled: number }[]; byStatus: { status: string; count: number }[]; byHour: { hour: number; count: number }[] };
const insights = (days: 7 | 30 | 90): Insights => fixture.insights[String(days)];

const figure = (page: Page, id: string) => page.locator(`figure[data-chart="${id}"]`);

async function open(page: Page, days?: number) {
  await page.goto(days ? `/admin/insights?range=${days}` : "/admin/insights");
  await revealStreamedContent(page);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
}

test.describe("Insights", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, "demo", baseURL!));

  test("each chart has a summary sentence, a labelled drawing and a table with the same numbers", async ({ page }) => {
    await open(page, 7);
    const data = insights(7);

    for (const id of ["per-day", "by-department", "by-status", "by-hour"]) {
      const chart = figure(page, id);
      await expect(chart).toBeVisible();
      await expect(chart.locator(".chart-summary")).not.toBeEmpty();
      await expect(chart.locator("details.chart-data table")).toHaveCount(1);
    }
    await expect(figure(page, "per-day").locator(".chart-summary")).toContainText(`${data.total} bookings in the last 7 days, not counting`);

    // The table behind the first chart: one row per day, the same counts as the columns.
    await figure(page, "per-day").getByText("Show data table").click();
    const rows = figure(page, "per-day").locator("tbody tr");
    await expect(rows).toHaveCount(7);
    for (const [index, day] of data.perDay.entries()) await expect(rows.nth(index).locator("td")).toHaveText(String(day.count));
    const columns = figure(page, "per-day").locator("[data-bar]");
    await expect(columns).toHaveCount(7);
    expect(await columns.evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-count"))))).toEqual(data.perDay.map((day) => day.count));

    // By department: the same departments, the cancelled column and a total that agrees with the first chart.
    await figure(page, "by-department").getByText("Show data table").click();
    const departments = figure(page, "by-department").locator("tbody tr");
    await expect(departments).toHaveCount(data.byDepartment.length);
    expect(await departments.evaluateAll((els) => els.reduce((sum, el) => sum + Number(el.querySelectorAll("td")[0]?.textContent), 0))).toBe(data.total);

    // By status: all five statuses, with their words.
    await expect(figure(page, "by-status").locator(".mix-list li")).toHaveCount(5);
    for (const row of data.byStatus) await expect(figure(page, "by-status").locator(`li[data-status="${row.status}"] .n`)).toHaveText(String(row.count));
  });

  test("the range switch moves between 7, 30 and 90 days through the address", async ({ page }) => {
    await open(page);
    const nav = page.getByRole("navigation", { name: "Date range" });
    await expect(nav.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page"); // the default
    for (const days of [7, 90, 30] as const) {
      await nav.getByRole("link", { name: `${days} days` }).click();
      await expect(page).toHaveURL(new RegExp(`range=${days}$`));
      await expect(figure(page, "per-day").locator("[data-bar]")).toHaveCount(days);
      await expect(figure(page, "per-day").locator(".chart-summary")).toContainText(`${insights(days).total} bookings in the last ${days} days, not counting`);
      await expect(nav.getByRole("link", { name: `${days} days` })).toHaveAttribute("aria-current", "page");
    }
  });

  test("an unknown range falls back to 30 days", async ({ page }) => {
    await open(page);
    await page.goto("/admin/insights?range=14");
    await expect(figure(page, "per-day").locator("[data-bar]")).toHaveCount(30);
  });

  test("the columns are one tab stop with arrow keys, and the focused one shows its figure", async ({ page, isMobile }) => {
    test.skip(isMobile, "arrow keys need a keyboard");
    await open(page, 7);
    const columns = figure(page, "per-day").locator("[data-bar]");
    const days = insights(7).perDay;
    expect(await columns.evaluateAll((els) => els.filter((el) => el.getAttribute("tabindex") === "0").length)).toBe(1);

    await columns.first().focus();
    await expect(columns.first()).toBeFocused();
    await expect(figure(page, "per-day").locator(".tip")).toContainText(String(days[0]!.count));
    await page.keyboard.press("ArrowRight");
    await expect(columns.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(columns.nth(6)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(columns.first()).toBeFocused();
    // Each column says its date and figure to a screen reader.
    await expect(columns.nth(2)).toHaveAttribute("aria-label", new RegExp(`: ${days[2]!.count} bookings?$`));

    const hours = figure(page, "by-hour").locator("[data-hour]");
    await hours.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(hours.nth(1)).toBeFocused();
    await expect(figure(page, "by-hour").locator(".heat-readout")).toContainText("booking");
  });

  test("every label and the tooltip stay inside the drawing", async ({ page, isMobile }) => {
    await open(page, 90);
    const chart = figure(page, "per-day");
    if (!isMobile) await chart.locator("[data-bar]").last().focus();
    const outside = await chart.locator("svg").evaluate((svg: SVGSVGElement) => {
      const box = svg.viewBox.baseVal;
      return Array.from(svg.querySelectorAll("text")).flatMap((text) => {
        const b = (text as SVGTextElement).getBBox();
        return b.x < box.x - 0.5 || b.y < box.y - 0.5 || b.x + b.width > box.x + box.width + 0.5 || b.y + b.height > box.y + box.height + 0.5 ? [text.textContent] : [];
      });
    });
    expect(outside).toEqual([]);
  });

  test("no-show and cancelled are told apart without colour", async ({ page }) => {
    await open(page, 30);
    const noShow = figure(page, "by-status").locator(".insight-bar .no_show");
    const cancelled = figure(page, "by-status").locator(".insight-bar .cancelled");
    for (const [segment, name] of [[noShow, "no_show"], [cancelled, "cancelled"]] as const) {
      await expect(segment, name).toHaveCount(1);
      expect(await segment.evaluate((el) => getComputedStyle(el).backgroundImage), name).not.toBe("none");
    }
    await expect(figure(page, "by-department").locator(".swatch.cancelled")).toHaveCount(1);
  });

  test("a clinic with too little data gets a calm empty state, not empty charts", async ({ context, page, baseURL }) => {
    await context.clearCookies();
    await signIn(context, "empty", baseURL!);
    await open(page, 30);
    await expect(page.getByRole("heading", { name: "Not enough bookings to chart yet" })).toBeVisible();
    await expect(page.locator("figure[data-chart]")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Date range" })).toBeVisible(); // the range can still be changed
  });
});
