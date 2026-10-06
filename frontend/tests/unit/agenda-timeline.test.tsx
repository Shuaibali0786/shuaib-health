import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgendaList } from "@/admin/overview/AgendaList";
import { AgendaTimeline, chipLabel, clampTipX } from "@/admin/overview/AgendaTimeline";

import { MIRZA, NOW, RAHMAN, booking, row } from "./helpers/overview-fixture";

const TZ = "Asia/Karachi";
const NONE = new Set<string>();

const agenda = () => [
  row(MIRZA, [["09:00", "13:00"]], [booking("D1", "09:00", "completed"), booking("D2", "11:40", "confirmed"), booking("D3", "12:00", "cancelled")]),
  row(RAHMAN, [["11:00", "15:00"]], [booking("D4", "11:15", "arrived", { doctor: RAHMAN, patientNameMasked: "Zara A." })]),
];

const timeline = (overrides: Partial<Parameters<typeof AgendaTimeline>[0]> = {}) => (
  <AgendaTimeline agenda={agenda()} nowMs={NOW} timeZone={TZ} highlight={NONE} onOpen={() => {}} {...overrides} />
);

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => vi.useRealTimers());

describe("chips", () => {
  it("each booking is a button named with its time, the patient's initials and status", () => {
    render(timeline());
    const chip = screen.getByRole("button", { name: "11:40, patient K.N., Confirmed. Open booking." });
    expect(chip.tagName).toBe("BUTTON");
    expect(chip).toHaveAttribute("data-ref", "D2");
    expect(screen.getByRole("button", { name: "12:00, patient K.N., Cancelled. Open booking." })).toBeInTheDocument();
    expect(chipLabel(booking("X", "11:15", "arrived", { patientNameMasked: "Zara A." }))).toBe("11:15, patient Z.A., Arrived. Open booking.");
  });

  it("opens the booking on click and on Enter, passing the chip back for the focus", async () => {
    vi.useRealTimers();
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(timeline({ onOpen }));
    const chip = screen.getByRole("button", { name: /^11:40/ });
    await user.click(chip);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ reference: "D2" }), chip);
    chip.focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("marks a new booking so it can glow", () => {
    render(timeline({ highlight: new Set(["D2"]) }));
    expect(screen.getByRole("button", { name: /^11:40/ })).toHaveClass("is-new");
    expect(screen.getByRole("button", { name: /^09:00/ })).not.toHaveClass("is-new");
  });
});

describe("tooltip", () => {
  it("shows time, initials and status on hover and on focus", () => {
    render(timeline());
    const chip = screen.getByRole("button", { name: /^11:40/ });
    fireEvent.mouseEnter(chip);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("11:40 K.N. Confirmed");
    expect(chip).toHaveAttribute("aria-describedby", tip.id);
    fireEvent.blur(chip);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(screen.getByRole("button", { name: /^11:15/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("11:15 Z.A. Arrived");
  });

  it("shows on a touch (pointer down that is not a mouse)", () => {
    render(timeline());
    fireEvent.pointerDown(screen.getByRole("button", { name: /^11:40/ }), { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("stays while the pointer moves from the chip onto the tooltip (WCAG 1.4.13), and goes when it leaves", () => {
    render(timeline());
    const chip = screen.getByRole("button", { name: /^11:40/ });
    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("tooltip"));
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape without moving focus", () => {
    render(timeline());
    const chip = screen.getByRole("button", { name: /^11:40/ });
    act(() => chip.focus());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(chip).toHaveFocus();
  });

  it("is clamped so its edges stay inside the timeline", () => {
    expect(clampTipX(5, 120, 800)).toBe(60); // too far left
    expect(clampTipX(795, 120, 800)).toBe(740); // too far right
    expect(clampTipX(400, 120, 800)).toBe(400); // already inside
    expect(clampTipX(10, 120, 100)).toBe(50); // the track is narrower than the tooltip: centre it
  });
});

describe("the now marker", () => {
  const marker = () => screen.getByTestId("now-marker");

  it("sits at the clinic time with its label", () => {
    render(timeline());
    expect(marker()).toHaveAttribute("data-label", "Now 11:20");
    expect(marker()).not.toHaveAttribute("hidden");
    expect(marker()).toHaveAttribute("aria-hidden", "true");
  });

  it("moves with the minute", () => {
    const { rerender } = render(timeline());
    const first = marker().style.left;
    rerender(timeline({ nowMs: NOW + 60_000 }));
    expect(marker()).toHaveAttribute("data-label", "Now 11:21");
    expect(marker().style.left).not.toBe(first);
  });

  it("is hidden before 09:00 and after 20:00", () => {
    const { rerender } = render(timeline({ nowMs: Date.parse("2026-10-05T03:30:00Z") })); // 08:30
    expect(marker()).toHaveAttribute("hidden");
    rerender(timeline({ nowMs: Date.parse("2026-10-05T15:30:00Z") })); // 20:30
    expect(marker()).toHaveAttribute("hidden");
    rerender(timeline({ nowMs: Date.parse("2026-10-05T15:00:00Z") })); // 20:00 exactly is still the edge
    expect(marker()).not.toHaveAttribute("hidden");
  });
});

describe("edge cases", () => {
  it("a doctor with many appointments keeps every one as its own chip inside the lane", () => {
    const many = Array.from({ length: 40 }, (_, i) => booking(`D${100 + i}`, `${String(9 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`));
    render(timeline({ agenda: [row(MIRZA, [["09:00", "20:00"]], many)] }));
    const group = screen.getByRole("group", { name: "Dr. Hassan Mirza, General Medicine" });
    expect(within(group).getAllByRole("button")).toHaveLength(40);
    expect(screen.getByTestId("agenda-timeline").parentElement).toHaveClass("tl-wrap"); // the wrapper that scrolls
  });

  it("a very long doctor name is cut on screen but whole in the accessible name and title", () => {
    const long = { ...MIRZA, name: "Dr. Muhammad Abdul Rahman Al-Hashimi bin Abdullah Qureshi" };
    render(timeline({ agenda: [row(long, [["09:00", "13:00"]], [booking("D1", "09:00", "confirmed", { doctor: long })])] }));
    expect(screen.getByRole("group", { name: `${long.name}, General Medicine` })).toBeInTheDocument();
    expect(screen.getByText(long.name)).toHaveAttribute("title", long.name);
  });

  it("widens the hour grid when a session or a booking falls outside 09:00 to 20:00", () => {
    render(timeline({ agenda: [row(MIRZA, [["08:00", "13:00"]], [booking("D1", "08:15")])] }));
    expect(screen.getByText("08:00")).toBeInTheDocument();
  });

  it("hatches the time outside the doctor's sessions", () => {
    const { container } = render(timeline());
    // Mirza works 09:00-13:00, so only the afternoon is hatched in his lane (the morning starts at the edge).
    expect(container.querySelectorAll(".tl-row")[0]?.querySelectorAll(".tl-off")).toHaveLength(1);
    // Rahman works 11:00-15:00: hatched before and after.
    expect(container.querySelectorAll(".tl-row")[1]?.querySelectorAll(".tl-off")).toHaveLength(2);
  });
});

describe("AgendaList (phones)", () => {
  const list = (overrides: Partial<Parameters<typeof AgendaList>[0]> = {}) => <AgendaList agenda={agenda()} nowMs={NOW} timeZone={TZ} highlight={NONE} onOpen={() => {}} {...overrides} />;

  it("lists each doctor with a button row per booking and a Now line before the first one still to come", () => {
    const { container } = render(list());
    expect(screen.getAllByRole("group", { hidden: true }).length).toBeGreaterThanOrEqual(0);
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(screen.getByTestId("now-row")).toHaveTextContent("Now 11:20");
    const mirza = container.querySelector('details[data-doc="' + MIRZA.id + '"]')!;
    // the marker comes right before the 11:40 booking
    expect(mirza.querySelector(".m-now + li button")).toHaveAttribute("data-ref", "D2");
    expect(within(mirza as HTMLElement).getAllByRole("button")).toHaveLength(3);
  });

  it("opens the doctor with the next patient first and keeps the visitor's choice when the data refreshes", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const { container, rerender } = render(list());
    const mirza = container.querySelector('details[data-doc="' + MIRZA.id + '"]') as HTMLDetailsElement;
    const rahman = container.querySelector('details[data-doc="' + RAHMAN.id + '"]') as HTMLDetailsElement;
    expect(mirza.open).toBe(true); // Mirza has the 11:40 patient to come
    expect(rahman.open).toBe(false);
    await user.click(rahman.querySelector("summary")!);
    expect(rahman.open).toBe(true);
    rerender(list({ agenda: agenda(), nowMs: NOW + 30_000 }));
    expect((container.querySelector('details[data-doc="' + RAHMAN.id + '"]') as HTMLDetailsElement).open).toBe(true);
  });

  it("a row opens the booking", async () => {
    vi.useRealTimers();
    const onOpen = vi.fn();
    render(list({ onOpen }));
    await userEvent.setup().click(screen.getByRole("button", { name: /11:40/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ reference: "D2" }), expect.any(HTMLElement));
  });
});
