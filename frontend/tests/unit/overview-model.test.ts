import { describe, expect, it } from "vitest";

import { agendaWindow, countStatuses, deriveOverview, initialsOf, lastWeekLabel, nextUpOf, offHours, refine, scheduledSlots, shortDoctor, trendView } from "@/admin/overview/model";

import { MIRZA, NOW, RAHMAN, booking, kpis, overview, row } from "./helpers/overview-fixture";

describe("names", () => {
  it("initials are the first and last word", () => {
    expect(initialsOf("Khadija N.")).toBe("K.N.");
    expect(initialsOf("Ali")).toBe("A.");
    expect(initialsOf("")).toBe("");
  });
  it("a doctor is Dr. and the surname", () => {
    expect(shortDoctor("Dr. Ayesha Rahman")).toBe("Dr. Rahman");
    expect(shortDoctor("Dr. Rahman")).toBe("Dr. Rahman");
  });
});

describe("trends", () => {
  const trend = (delta: number | null) => ({ value: 10, previous: 10 - (delta ?? 0), delta, comparedTo: "2026-09-28" });
  it("says it in words and in points for utilisation", () => {
    expect(lastWeekLabel("2026-09-28")).toBe("last Mon");
    expect(trendView(trend(-4))).toMatchObject({ direction: "down", text: "4", phrase: "down 4 on last Mon" });
    expect(trendView(trend(3))?.phrase).toBe("up 3 on last Mon");
    expect(trendView(trend(0))).toMatchObject({ direction: "flat", phrase: "same as last Mon" });
    expect(trendView(trend(-6), "pts")).toMatchObject({ text: "6 pts", phrase: "down 6 pts on last Mon" });
    expect(trendView(trend(null))).toBeNull();
  });
});

describe("the agenda window", () => {
  it("is 09:00 to 20:00 unless something falls outside", () => {
    expect(agendaWindow([row(MIRZA, [["10:00", "14:00"]], [booking("A", "10:00")])])).toEqual({ start: 540, end: 1200 });
    expect(agendaWindow([row(MIRZA, [["08:00", "21:30"]], [])])).toEqual({ start: 480, end: 1320 });
  });
  it("hatches what is outside the sessions, gaps included", () => {
    const window = { start: 540, end: 1200 };
    expect(offHours([{ start: "09:00", end: "13:00" }], window)).toEqual([{ from: 780, to: 1200 }]);
    expect(offHours([{ start: "10:00", end: "12:00" }, { start: "14:00", end: "16:00" }], window)).toEqual([
      { from: 540, to: 600 },
      { from: 720, to: 840 },
      { from: 960, to: 1200 },
    ]);
    expect(offHours([], window)).toEqual([{ from: 540, to: 1200 }]);
  });
});

describe("next patients up", () => {
  it("is confirmed, not older than 15 minutes, soonest first, five at most", () => {
    const items = [booking("A", "11:06"), booking("B", "11:05"), booking("C", "11:40", "arrived"), booking("D", "12:00", "cancelled"), ...["E", "F", "G", "H", "I", "J"].map((r, i) => booking(r, `12:${String(i * 5).padStart(2, "0")}`))];
    expect(nextUpOf(items, NOW).map((b) => b.reference)).toEqual(["A", "E", "F", "G", "H"]);
  });
});

describe("refine", () => {
  it("recomputes the allowed steps with the clock", () => {
    const b = booking("A", "14:00");
    expect(refine(b, NOW).allowedNext).toEqual(["cancelled"]); // arrival opens at 12:00
    expect(refine(b, NOW + 45 * 60_000).allowedNext).toEqual(["arrived", "cancelled"]);
    expect(refine(booking("A", "11:00"), NOW).allowedNext).toEqual(["arrived", "no_show"]); // already started: cancel is closed
    expect(refine(b, NOW)).not.toBe(b);
    const same = refine(b, NOW);
    expect(refine(same, NOW)).toBe(same); // unchanged: the same object
  });
});

describe("deriveOverview", () => {
  const base = () =>
    overview(
      [
        row(MIRZA, [["09:00", "13:00"]], [booking("A", "09:00", "completed"), booking("B", "11:40"), booking("C", "12:00", "cancelled")]),
        row(RAHMAN, [["11:00", "15:00"]], [booking("D", "13:00", "confirmed", { doctor: RAHMAN })]),
      ],
      { kpis: kpis({ appointments: { value: 3, previous: 5, delta: -2, comparedTo: "2026-09-28" }, utilisationPct: { value: 19, previous: 20, delta: -1, comparedTo: "2026-09-28" } }) },
    );

  it("recomputes counts, the status mix and next patients from the bookings", () => {
    const view = deriveOverview(base(), { nowMs: NOW });
    expect(view.kpis.appointments.value).toBe(3);
    expect(view.kpis.arrived.value).toBe(1);
    expect(view.kpis.cancellations.value).toBe(1);
    expect(view.nextUp.map((b) => b.reference)).toEqual(["B", "D"]);
    expect(countStatuses(view.agenda.flatMap((r) => r.items))).toEqual({ confirmed: 2, arrived: 0, completed: 1, no_show: 0, cancelled: 1 });
    expect(view.kpis.utilisationPct.value).toBe(19); // the booked count did not move: the server's figure stays
  });

  it("lays the visitor's own status changes over the server's, and every card follows", () => {
    const view = deriveOverview(base(), { nowMs: NOW, statusOf: (ref, status) => (ref === "B" ? "arrived" : status) });
    expect(view.kpis.arrived.value).toBe(2);
    expect(view.kpis.arrived.delta).toBe(2 - 8); // the fixture's last week: 8
    expect(view.nextUp.map((b) => b.reference)).toEqual(["D"]);
    expect(view.agenda[0]?.items.find((b) => b.reference === "B")?.status).toBe("arrived");
  });

  it("adds simulated bookings to their doctor, in time order, and recomputes utilisation", () => {
    const extra = booking("X", "11:50", "confirmed");
    const view = deriveOverview(base(), { nowMs: NOW, extras: [extra] });
    expect(view.agenda[0]?.items.map((b) => b.reference)).toEqual(["A", "B", "X", "C"]);
    expect(view.kpis.appointments.value).toBe(4);
    // 4 booked of 16 + 16 scheduled slots = 12.5 % -> 13 %
    expect(scheduledSlots(view.agenda)).toBe(32);
    expect(view.kpis.utilisationPct.value).toBe(13);
    expect(view.nextUp.map((b) => b.reference)).toEqual(["B", "X", "D"]);
  });

  it("does not change the answer it was given", () => {
    const original = base();
    const copy = structuredClone(original);
    deriveOverview(original, { nowMs: NOW, statusOf: () => "arrived", extras: [booking("X", "11:50")] });
    expect(original).toEqual(copy);
  });
});
