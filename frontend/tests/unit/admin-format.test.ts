// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

import { clinicDate, formatClock, formatClockShort, formatDayMonth, formatLongDate, formatTime, greeting } from "@/admin/lib/format";

// The clinic is in Asia/Karachi (UTC+5, no daylight saving). The device is deliberately somewhere else.
beforeAll(() => {
  process.env.TZ = "America/New_York";
});

// Mon 5 Oct 2026, 11:20:45 in Karachi.
const NOW = "2026-10-05T06:20:45Z";
const at = (clinicClock: string, date = "2026-10-05") => new Date(`${date}T${clinicClock}+05:00`);

describe("device time zone", () => {
  it("really differs from the clinic's, so the tests below prove independence", () => {
    expect(new Date(NOW).getHours()).toBe(2); // 02:20 in New York (EDT)
  });
});

describe("formatTime and formatClock", () => {
  it("shows clinic time, not device time", () => {
    expect(formatTime(NOW)).toBe("11:20");
    expect(formatClock(NOW)).toBe("11:20:45 AM");
  });

  it("uses 24-hour time in tables and midnight as 00:00", () => {
    expect(formatTime(at("00:05:00"))).toBe("00:05");
    expect(formatTime(at("15:45:00"))).toBe("15:45");
  });

  it("writes the clock with AM and PM and no leading zero on the hour", () => {
    expect(formatClock(at("09:05:07"))).toBe("9:05:07 AM");
    expect(formatClock(at("12:00:00"))).toBe("12:00:00 PM");
    expect(formatClock(at("23:59:59"))).toBe("11:59:59 PM");
    expect(formatClock(at("00:00:00"))).toBe("12:00:00 AM");
  });

  it("accepts a Date or a timestamp as well as an ISO string", () => {
    expect(formatTime(new Date(NOW))).toBe("11:20");
    expect(formatTime(Date.parse(NOW))).toBe("11:20");
  });
});

describe("clinicDate", () => {
  it("is the clinic's calendar day, which can be ahead of the device's", () => {
    // 20:30 UTC on the 5th is 01:30 on the 6th in Karachi and still the 5th in New York.
    expect(clinicDate("2026-10-05T20:30:00Z")).toBe("2026-10-06");
    expect(clinicDate("2026-10-05T18:59:59Z")).toBe("2026-10-05");
    expect(clinicDate("2026-10-05T19:00:00Z")).toBe("2026-10-06");
  });
});

describe("date labels", () => {
  it("writes the short day and month", () => {
    expect(formatDayMonth("2026-10-05")).toBe("Mon 5 Oct");
    expect(formatDayMonth("2026-12-31")).toBe("Thu 31 Dec");
    expect(formatDayMonth("2027-03-01")).toBe("Mon 1 Mar");
  });

  it("is not shifted by the device zone near midnight", () => {
    expect(formatDayMonth("2026-10-06")).toBe("Tue 6 Oct");
  });

  it("writes the long date for headings", () => {
    expect(formatLongDate("2026-10-05")).toBe("Monday 5 October 2026");
  });
});

describe("greeting follows the clinic hour", () => {
  it.each([
    ["04:59:59", "Good evening"],
    ["05:00:00", "Good morning"],
    ["11:59:59", "Good morning"],
    ["12:00:00", "Good afternoon"],
    ["16:59:59", "Good afternoon"],
    ["17:00:00", "Good evening"],
    ["23:30:00", "Good evening"],
    ["00:00:00", "Good evening"],
  ])("at %s clinic time: %s", (clock, expected) => {
    expect(greeting(at(clock))).toBe(expected);
  });

  it("ignores the device zone: 02:20 in New York is 11:20 in Karachi", () => {
    expect(greeting(NOW)).toBe("Good morning");
  });
});

describe("formatClockShort", () => {
  it("shows the clinic time without seconds, as in a sign-in time", () => {
    expect(formatClockShort("2026-10-05T02:52:41Z")).toBe("7:52 AM");
    expect(formatClockShort("2026-10-05T12:38:00Z")).toBe("5:38 PM");
    expect(formatClockShort("2026-10-05T07:00:00Z")).toBe("12:00 PM");
  });
});
