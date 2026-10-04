import { describe, expect, it } from "vitest";

import { dayStatusLabel, formatLocalDate, partOfDay, timeZoneLabel } from "@/lib/booking/labels";

describe("dayStatusLabel", () => {
  it.each([
    ["available", "Available"],
    ["fully_booked", "Fully booked"],
    ["doctor_unavailable", "Not available"],
    ["clinic_closed", "Clinic closed"],
    ["not_working", "Not available"],
    ["no_longer_available", "No times left today"],
  ] as const)("%s -> %s", (status, label) => {
    expect(dayStatusLabel(status)).toBe(label);
  });
});

describe("partOfDay", () => {
  it.each([
    ["00:00", "morning"],
    ["09:45", "morning"],
    ["11:59", "morning"],
    ["12:00", "afternoon"],
    ["16:59", "afternoon"],
    ["17:00", "evening"],
    ["23:45", "evening"],
  ] as const)("%s is %s", (time, part) => {
    expect(partOfDay(time)).toBe(part);
  });
});

describe("formatLocalDate", () => {
  it("formats a clinic-local date like 'Tue 6 Oct'", () => {
    expect(formatLocalDate("2026-10-06")).toBe("Tue 6 Oct");
  });
});

describe("timeZoneLabel", () => {
  it("gives the long zone name", () => {
    expect(timeZoneLabel("Asia/Karachi")).toBe("Pakistan Standard Time");
  });
});
