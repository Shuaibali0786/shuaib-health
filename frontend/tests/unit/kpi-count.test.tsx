import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COUNT_CHANGE_MS, COUNT_FIRST_MS, CountUp, countValue } from "@/admin/overview/CountUp";
import { KpiGrid } from "@/admin/overview/KpiGrid";

import { kpis } from "./helpers/overview-fixture";

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance", "Date"] });
  motion(false);
});
afterEach(() => vi.useRealTimers());

const visual = () => screen.getByTestId("count-visual").textContent;
const spoken = () => screen.getByTestId("count-final").textContent;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("countValue", () => {
  it("eases from the start to the end and stays at the end", () => {
    expect(countValue(0, 50, 0, 900)).toBe(0);
    expect(countValue(0, 50, 450, 900)).toBeGreaterThan(25); // ease-out: more than half done at half time
    expect(countValue(0, 50, 900, 900)).toBe(50);
    expect(countValue(0, 50, 5000, 900)).toBe(50);
    expect(countValue(10, 4, 900, 900)).toBe(4);
  });
});

describe("CountUp", () => {
  it("counts up from 0 in about 0.9 s on the first load", () => {
    render(<CountUp value={50} />);
    expect(COUNT_FIRST_MS).toBe(900);
    expect(Number(visual())).toBeLessThan(50);
    advance(450);
    const half = Number(visual());
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(50);
    advance(500);
    expect(visual()).toBe("50");
  });

  it("counts from the shown number to the new one in about 0.5 s when the value changes", () => {
    const { rerender } = render(<CountUp value={50} />);
    advance(1000);
    rerender(<CountUp value={60} />);
    expect(COUNT_CHANGE_MS).toBe(500);
    expect(visual()).toBe("50");
    advance(250);
    const mid = Number(visual());
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(60);
    advance(300);
    expect(visual()).toBe("60");
  });

  it("shows the final value at once when the visitor asked for less motion", () => {
    motion(true);
    const { rerender } = render(<CountUp value={50} />);
    expect(visual()).toBe("50");
    rerender(<CountUp value={61} />);
    expect(visual()).toBe("61");
  });

  it("gives screen readers only the final value, never the numbers on the way", () => {
    render(<CountUp value={72} suffix="%" />);
    expect(screen.getByTestId("count-visual")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("count-final")).toHaveClass("sr-only");
    expect(spoken()).toBe("72%");
    advance(300);
    expect(spoken()).toBe("72%");
    advance(1000);
    expect(spoken()).toBe("72%");
  });
});

describe("KpiGrid", () => {
  it("shows the six KPIs with the trend sentence for screen readers", () => {
    motion(true);
    render(<KpiGrid kpis={kpis()} />);
    expect(screen.getByRole("region", { name: "Today in numbers" })).toBeInTheDocument();
    for (const label of ["Appointments", "Checked in", "Completed", "No-shows", "Cancellations", "Chair utilisation"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("down 4 on last Mon")).toHaveClass("sr-only");
    expect(screen.getAllByText("same as last Mon")).toHaveLength(2); // arrived and completed, 8 -> 8
    expect(screen.getByText("up 1 on last Mon")).toBeInTheDocument(); // cancellations 5 vs 4
    expect(screen.getByText("down 6 pts on last Mon")).toBeInTheDocument(); // utilisation, in points
    expect(screen.getAllByText(/^vs last Mon$/)).toHaveLength(6);
  });

  it("calls the arrivals KPI 'Checked in' and explains it in a tooltip a keyboard can reach", () => {
    motion(true);
    render(<KpiGrid kpis={kpis()} />);
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument(); // never next to the status mix's own "Arrived"
    const label = screen.getByText("Checked in");
    expect(label).toHaveAttribute("tabindex", "0");
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(label).toHaveAttribute("aria-describedby", tip.id);
    expect(tip).toHaveTextContent(/Arrived plus Completed/);
  });

  it("colours a change by what it means, not by its arrow", () => {
    motion(true);
    const trend = (previous: number, value: number) => ({ value, previous, delta: value - previous, comparedTo: "2026-09-28" });
    const tone = (key: string) => document.querySelector(`[data-kpi="${key}"] .trend`)!;
    // Fewer no-shows and cancellations: good, though the arrow points down.
    const { unmount } = render(<KpiGrid kpis={kpis({ appointments: trend(30, 34), noShows: trend(5, 2), cancellations: trend(4, 1), completed: trend(8, 6) })} />);
    expect(tone("noShows")).toHaveClass("good", "down");
    expect(tone("cancellations")).toHaveClass("good");
    expect(tone("appointments")).toHaveClass("good"); // up is good here
    expect(tone("completed")).toHaveClass("bad"); // down is bad here
    unmount();
    // More no-shows and cancellations: bad, though the arrow points up.
    render(<KpiGrid kpis={kpis({ noShows: trend(2, 5), cancellations: trend(1, 4), arrived: trend(8, 8) })} />);
    expect(tone("noShows")).toHaveClass("bad", "up");
    expect(tone("cancellations")).toHaveClass("bad");
    expect(tone("arrived")).toHaveClass("flat");
  });

  it("shows a dash, and says why, when utilisation cannot be worked out", () => {
    motion(true);
    render(<KpiGrid kpis={kpis({ utilisationPct: { value: null, previous: 70, delta: null, comparedTo: "2026-09-28" } })} />);
    expect(screen.getByText("Not available, no scheduled slots today")).toBeInTheDocument();
  });
});
