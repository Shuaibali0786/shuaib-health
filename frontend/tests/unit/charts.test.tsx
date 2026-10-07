import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ChartFigure } from "@/admin/charts/ChartFigure";
import { ColumnChart } from "@/admin/charts/ColumnChart";
import { HourHeatStrip } from "@/admin/charts/HourHeatStrip";
import { InsightsView } from "@/admin/charts/InsightsView";
import { MIN_BOOKINGS, departmentSummary, heatLevel, hourSummary, hourWindow, niceMax, perDaySummary, statusSummary } from "@/admin/charts/model";
import { InsightsSchema, type Insights } from "@/admin/lib/schemas";

const fixture = JSON.parse(readFileSync("tests/fixtures/admin/demo-day.json", "utf8"));
const week: Insights = InsightsSchema.parse(fixture.insights["7"]);
const quarter: Insights = InsightsSchema.parse(fixture.insights["90"]);

describe("insights model", () => {
  it("rounds the top of the scale to a clean figure", () => {
    expect([0, 1, 3, 4, 7, 11, 23, 48, 101, 460].map(niceMax)).toEqual([1, 1, 3, 4, 10, 20, 50, 50, 200, 500]);
  });

  it("writes the summary sentences from the numbers", () => {
    expect(perDaySummary(week)).toMatch(new RegExp(`^${week.total} bookings in the last 7 days, not counting \\d+ cancelled\\. [\\d.]+ a day on average; busiest day \\w{3} \\d+ \\w{3,4} with \\d+\\.$`));
    expect(departmentSummary(week)).toContain(week.byDepartment[0]!.departmentName);
    expect(statusSummary(week)).toMatch(/^All \d+ bookings, cancelled included: \d+ confirmed, \d+ arrived, \d+ completed, \d+ no-show, \d+ cancelled\.$/);
    expect(hourSummary(week)).toMatch(/^Busiest hour \d\d:00 to \d\d:00 with \d+ bookings, clinic time\.$/);
    expect(perDaySummary({ ...week, total: 0, perDay: week.perDay.map((d) => ({ ...d, count: 0 })) })).toBe("No bookings in the last 7 days.");
  });

  it("shades a cell in five steps of one colour and widens the hour window to what has bookings", () => {
    expect([0, 1, 12, 13, 25, 26, 37, 38, 50].map((n) => heatLevel(n, 50))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 6 || hour === 22 ? 3 : 0 }));
    expect(hourWindow(hours)).toEqual({ from: 6, to: 22 });
    expect(hourWindow(hours.map((h) => ({ ...h, count: 0 })))).toEqual({ from: 8, to: 20 });
  });
});

describe("ChartFigure", () => {
  it("is a figure with a title, a summary and the same numbers in a real table behind Show data table", () => {
    render(
      <ChartFigure id="demo" title="Demo chart" summary="Three things happened." table={{ caption: "Things", head: ["Thing", "Count"], rows: [["A", 1], ["B", 2]] }}>
        <svg role="group" aria-label="drawing" />
      </ChartFigure>,
    );
    const figure = screen.getByRole("figure", { name: "Demo chart" });
    expect(figure).toHaveAccessibleDescription("Three things happened.");
    expect(within(figure).getByText("Show data table").closest("details")).not.toHaveAttribute("open");
    const table = within(figure).getByRole("table", { name: "Things", hidden: true });
    expect(within(table).getAllByRole("columnheader", { hidden: true }).map((c) => c.textContent)).toEqual(["Thing", "Count"]);
    expect(within(table).getAllByRole("row", { hidden: true }).map((r) => r.textContent)).toEqual(["ThingCount", "A1", "B2"]);
  });
});

describe("ColumnChart", () => {
  it("draws one labelled, focusable column per day with one tab stop", () => {
    render(<ColumnChart days={week.perDay} ariaLabel="Bookings per day" />);
    expect(screen.getByRole("group", { name: "Bookings per day" })).toBeInTheDocument();
    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(7);
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual(week.perDay.map((d) => expect.stringMatching(new RegExp(`^\\w{3} \\d+ \\w{3,4}: ${d.count} bookings?$`))));
    expect(bars.filter((bar) => bar.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("moves with the arrow keys and shows the figure of the focused column", () => {
    const { container } = render(<ColumnChart days={week.perDay} ariaLabel="Bookings per day" />);
    const bars = screen.getAllByRole("img");
    fireEvent.focus(bars[0]!);
    expect(container.querySelector(".tip")).toHaveTextContent(String(week.perDay[0]!.count));
    fireEvent.keyDown(bars[0]!, { key: "ArrowRight" });
    expect(bars[1]).toHaveFocus();
    fireEvent.keyDown(bars[1]!, { key: "End" });
    expect(bars[6]).toHaveFocus();
    fireEvent.keyDown(bars[6]!, { key: "ArrowRight" }); // no further
    expect(bars[6]).toHaveFocus();
    fireEvent.keyDown(bars[6]!, { key: "Home" });
    expect(bars[0]).toHaveFocus();
  });

  it("scales 90 days into one chart without a label on every column", () => {
    const { container } = render(<ColumnChart days={quarter.perDay} ariaLabel="Bookings per day" />);
    expect(screen.getAllByRole("img")).toHaveLength(90);
    expect(container.querySelectorAll("text.axis").length).toBeLessThan(15);
  });
});

describe("HourHeatStrip", () => {
  it("has a labelled cell per hour of the clinic day, one marked busiest, and a readout on focus", () => {
    const { container } = render(<HourHeatStrip byHour={week.byHour} />);
    const cells = screen.getAllByRole("img");
    expect(cells.length).toBeGreaterThanOrEqual(13);
    expect(cells[0]).toHaveAttribute("aria-label", expect.stringMatching(/^\d\d:00 to \d\d:00: \d+ bookings?$/));
    expect(container.querySelectorAll(".cell.peak").length).toBeGreaterThanOrEqual(1); // ties are all marked
    expect(container.querySelector(".cell.peak")).toHaveTextContent("▲"); // not by shade alone
    fireEvent.focus(cells[2]!);
    expect(container.querySelector(".heat-readout")).toHaveTextContent(/booking/);
  });
});

describe("InsightsView", () => {
  it("renders the four figures with a table each", () => {
    const { container } = render(<InsightsView data={week} />);
    expect(screen.getAllByRole("figure")).toHaveLength(4);
    expect(container.querySelectorAll("figure details table")).toHaveLength(4);
    expect(container.querySelectorAll("[data-count][data-bar]")).toHaveLength(7);
  });

  it("says there is too little data below five bookings instead of drawing empty charts", () => {
    const tiny: Insights = { ...week, total: MIN_BOOKINGS - 1 };
    render(<InsightsView data={tiny} />);
    expect(screen.getByRole("heading", { name: "Not enough bookings to chart yet" })).toBeInTheDocument();
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
  });
});
