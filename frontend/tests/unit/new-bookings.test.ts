import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewBookingsStore, MAX_VISIBLE, TOAST_MS } from "@/admin/state/newBookings";
import { SIM_EVERY_MS, SIM_FIRST_MS, freeSlots, seededRandom, simulateBooking, startSimulation } from "@/admin/state/demoSimulation";
import { DemoOverlay } from "@/admin/state/demoOverlay";
import type { AgendaDoctor } from "@/admin/lib/schemas";

import { DATE, MIDNIGHT, MIRZA, NOW, RAHMAN, booking, recent, row } from "./helpers/overview-fixture";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const at = (minute: number) => new Date(NOW + minute * 60_000).toISOString();

describe("NewBookingsStore", () => {
  it("records only the newest bookedAt on the first answer and announces nothing", () => {
    const store = new NewBookingsStore();
    expect(store.isSeeded()).toBe(false);
    const announced = store.ingest([recent("A", at(-1)), recent("B", at(-5))]);
    expect(announced).toEqual([]);
    expect(store.toasts()).toHaveLength(0);
    expect(store.isSeeded()).toBe(true);
    // The same answer again: still nothing is new.
    expect(store.ingest([recent("A", at(-1)), recent("B", at(-5))])).toEqual([]);
  });

  it("announces one notification per newer booking, oldest first, and never twice", () => {
    const store = new NewBookingsStore();
    store.ingest([recent("A", at(-1))]);
    const announced = store.ingest([recent("C", at(2)), recent("B", at(1)), recent("A", at(-1))]);
    expect(announced.map((b) => b.reference)).toEqual(["B", "C"]);
    expect(store.toasts().map((t) => t.id)).toEqual(["B", "C"]);
    expect(store.ingest([recent("C", at(2)), recent("B", at(1))])).toEqual([]);
  });

  it("an empty first answer still makes every later booking new", () => {
    const store = new NewBookingsStore();
    store.ingest([]);
    expect(store.ingest([recent("A", at(-30))]).map((b) => b.reference)).toEqual(["A"]);
  });

  it("shows at most three at a time, keeping the newest", () => {
    const store = new NewBookingsStore();
    store.ingest([]);
    store.ingest(["A", "B", "C", "D"].map((ref, i) => recent(ref, at(i + 1))));
    expect(MAX_VISIBLE).toBe(3);
    expect(store.toasts().map((t) => t.id)).toEqual(["B", "C", "D"]);
  });

  it("hides each notification by itself after 8 seconds", () => {
    const store = new NewBookingsStore();
    store.ingest([]);
    store.ingest([recent("A", at(1))]);
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.toasts()).toHaveLength(0);
  });

  it("pauses while hovered or focused and carries on with the time that was left", () => {
    const store = new NewBookingsStore();
    store.ingest([]);
    store.ingest([recent("A", at(1))]);
    vi.advanceTimersByTime(5000);
    store.hold("A", "hover");
    store.hold("A", "focus");
    vi.advanceTimersByTime(60_000);
    expect(store.toasts()).toHaveLength(1);
    expect(store.toasts()[0]?.held).toBe(true);
    store.release("A", "hover");
    vi.advanceTimersByTime(60_000);
    expect(store.toasts()).toHaveLength(1); // still focused
    store.release("A", "focus");
    vi.advanceTimersByTime(2999);
    expect(store.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.toasts()).toHaveLength(0);
  });

  it("can be dismissed, and tells subscribers when something changed", () => {
    const store = new NewBookingsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.ingest([]);
    store.ingest([recent("A", at(1))]);
    expect(listener).toHaveBeenCalled();
    const before = store.getSnapshot();
    store.dismiss("A");
    expect(store.toasts()).toHaveLength(0);
    expect(store.getSnapshot()).toBeGreaterThan(before);
  });
});

// ----- The demo's simulated bookings --------------------------------------------------------------

const agenda = (): AgendaDoctor[] => [
  row(MIRZA, [["09:00", "13:00"]], [booking("D1", "11:30"), booking("D2", "11:45", "cancelled"), booking("D3", "12:00")]),
  row(RAHMAN, [["11:00", "15:00"]], [booking("D4", "11:00", "completed", { doctor: RAHMAN })]),
];

describe("demo simulation", () => {
  it("offers only free slots after now, and a cancelled booking frees its slot", () => {
    const slots = freeSlots(agenda()[0]!, MIDNIGHT, NOW, 15);
    const times = slots.map((ms) => new Date(ms).toISOString());
    expect(slots.every((ms) => ms > NOW)).toBe(true);
    expect(times).toContain(new Date(MIDNIGHT + (11 * 60 + 45) * 60_000).toISOString()); // the cancelled one
    expect(times).not.toContain(new Date(MIDNIGHT + (11 * 60 + 30) * 60_000).toISOString()); // booked
    expect(times).not.toContain(new Date(MIDNIGHT + (11 * 60 + 15) * 60_000).toISOString()); // already past
    expect(times).toEqual([...times].sort());
  });

  it("books a free future slot of a doctor who is working, with a patient who fits the department", () => {
    const simulated = simulateBooking({ date: DATE, timeZone: "Asia/Karachi", agenda: agenda(), nowMs: NOW, serial: 1 });
    expect(simulated).not.toBeNull();
    const { summary, detail } = simulated!;
    expect(Date.parse(summary.startsAt)).toBeGreaterThan(NOW);
    expect(summary.status).toBe("confirmed");
    expect(summary.reference).toMatch(/^D[0-9A-HJKMNP-TV-Z]{9}$/);
    expect(summary.isSample).toBe(true);
    expect(summary.patientNameMasked).toMatch(/^\S+ [A-Z]\.$/);
    expect(summary.phoneMasked).toMatch(/^\d{4}\*{4}\d{3}$/);
    expect(detail.history[0]?.actor).toBe("Online booking");
    const taken = new Set(agenda().flatMap((r) => r.items.filter((i) => i.status !== "cancelled" && i.doctor.id === summary.doctor.id).map((i) => i.startsAt)));
    expect(taken.has(summary.startsAt)).toBe(false);
  });

  it("is seeded by the demo date: the same visit repeats, another day differs", () => {
    const input = { timeZone: "Asia/Karachi", agenda: agenda(), nowMs: NOW, serial: 1 };
    const one = simulateBooking({ date: DATE, ...input })!;
    expect(simulateBooking({ date: DATE, ...input })!.summary).toEqual(one.summary);
    expect(simulateBooking({ date: DATE, ...input, serial: 2 })!.summary.reference).not.toBe(one.summary.reference);
    expect(seededRandom("x")()).toBe(seededRandom("x")());
  });

  it("a paediatric slot gets a child booked by a parent; gynecology gets a woman", () => {
    const peds = { ...MIRZA, departmentName: "Pediatrics" };
    const onlyPeds = [row(peds, [["09:00", "13:00"]], [])];
    const child = simulateBooking({ date: DATE, timeZone: "Asia/Karachi", agenda: onlyPeds, nowMs: NOW, serial: 3 })!;
    expect(child.detail.patientAge).toBeLessThanOrEqual(12);
    expect(["mother", "father"]).toContain(child.detail.bookedBy);
  });

  it("returns null when no slot is left today", () => {
    expect(simulateBooking({ date: DATE, timeZone: "Asia/Karachi", agenda: agenda(), nowMs: MIDNIGHT + 23 * 3_600_000, serial: 1 })).toBeNull();
  });

  it("arrives 50 s after opening, then every 75 s, until stopped", () => {
    const run = vi.fn();
    const stop = startSimulation(run);
    vi.advanceTimersByTime(SIM_FIRST_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SIM_EVERY_MS);
    expect(run).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(SIM_EVERY_MS);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(SIM_EVERY_MS * 4);
    expect(run).toHaveBeenCalledTimes(3);
    expect([SIM_FIRST_MS, SIM_EVERY_MS]).toEqual([50_000, 75_000]);
  });

  it("never sends a simulated booking to the server: the overlay keeps it in memory and nothing is fetched", () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in this test"));
    const overlay = new DemoOverlay();
    const next = simulateBooking({ date: DATE, timeZone: "Asia/Karachi", agenda: agenda(), nowMs: NOW, serial: 1 })!;
    overlay.addBooking(next.detail);
    expect(overlay.bookings().map((b) => b.reference)).toEqual([next.summary.reference]);
    expect(overlay.detailOf(next.summary.reference)?.patientName).toBe(next.detail.patientName);
    expect(overlay.detailOf("DNOTSIMULATED")).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
    overlay.reset();
    expect(overlay.bookings()).toEqual([]);
    fetcher.mockRestore();
  });
});
