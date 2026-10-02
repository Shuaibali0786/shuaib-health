import { describe, expect, it } from "vitest";
import { availableDays, groupScheduleByDay, nextAvailable } from "@/lib/schedule";
import type { ScheduleSession } from "@/types/content";

/** A moment given as Karachi wall-clock time (UTC+5, no daylight saving). 2026-10-05 is a Monday. */
const karachi = (iso: string): Date => new Date(`${iso}+05:00`);

const schedule: ScheduleSession[] = [
  { day: "wed", start: "09:00", end: "13:00" },
  { day: "mon", start: "16:00", end: "20:00" },
  { day: "mon", start: "09:00", end: "12:00" },
  { day: "sat", start: "10:00", end: "14:00" },
];

describe("availableDays and groupScheduleByDay", () => {
  it("lists weekdays Monday first without duplicates", () => {
    expect(availableDays(schedule)).toEqual(["mon", "wed", "sat"]);
  });

  it("groups sessions by day and sorts them by start time", () => {
    const grouped = groupScheduleByDay(schedule);
    expect(grouped.map((group) => group.day)).toEqual(["mon", "wed", "sat"]);
    expect(grouped[0]?.sessions.map((session) => session.start)).toEqual(["09:00", "16:00"]);
  });
});

describe("nextAvailable (Asia/Karachi)", () => {
  it("is today while a session has not ended yet", () => {
    expect(nextAvailable(schedule, karachi("2026-10-05T10:00:00"))).toEqual({ kind: "today", day: "mon", start: "09:00", end: "12:00" });
  });

  it("moves to the later session once the first has ended", () => {
    expect(nextAvailable(schedule, karachi("2026-10-05T12:30:00"))).toEqual({ kind: "today", day: "mon", start: "16:00", end: "20:00" });
  });

  it("is tomorrow when today's sessions are over and the next day has one", () => {
    expect(nextAvailable([{ day: "tue", start: "10:00", end: "14:00" }, { day: "mon", start: "09:00", end: "10:00" }], karachi("2026-10-05T11:00:00"))).toEqual({
      kind: "tomorrow",
      day: "tue",
      start: "10:00",
    });
  });

  it("names a later weekday when tomorrow has no session", () => {
    expect(nextAvailable(schedule, karachi("2026-10-05T21:00:00"))).toEqual({ kind: "later", day: "wed", start: "09:00" });
  });

  it("skips Sunday: on a Sunday the next session is Monday (tomorrow)", () => {
    expect(nextAvailable(schedule, karachi("2026-10-04T12:00:00"))).toEqual({ kind: "tomorrow", day: "mon", start: "09:00" });
  });

  it("uses the Karachi day, not the UTC day, around midnight", () => {
    // 2026-10-05 23:59 in Karachi is still Monday (18:59 UTC); one minute later it is Tuesday.
    expect(nextAvailable([{ day: "mon", start: "20:00", end: "23:59" }, { day: "tue", start: "09:00", end: "11:00" }], karachi("2026-10-05T23:58:00"))).toMatchObject({ kind: "today", day: "mon" });
    expect(nextAvailable([{ day: "mon", start: "09:00", end: "11:00" }, { day: "tue", start: "09:00", end: "11:00" }], karachi("2026-10-06T00:01:00"))).toMatchObject({ kind: "today", day: "tue" });
  });

  it("works for a doctor with a single weekly session, wrapping to next week", () => {
    expect(nextAvailable([{ day: "fri", start: "15:00", end: "19:00" }], karachi("2026-10-09T20:00:00"))).toEqual({ kind: "later", day: "fri", start: "15:00" });
  });

  it("returns undefined for an empty schedule", () => {
    expect(nextAvailable([], karachi("2026-10-05T10:00:00"))).toBeUndefined();
  });
});
