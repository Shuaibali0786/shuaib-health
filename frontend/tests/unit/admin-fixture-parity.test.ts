// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BookingStatusSchema, StaffListSchema, ViewerSchema } from "@/admin/lib/schemas";

// tests/fixtures/admin/demo-day.json is produced by the backend generator
// (uv run python -m app.demo.export_fixture --date 2026-10-05 --now 11:20) and served by the mock API.
// The backend test test_demo_export.py keeps it equal to the generator; this keeps it valid for the website.

const fixture = JSON.parse(readFileSync(new URL("../fixtures/admin/demo-day.json", import.meta.url), "utf8"));

describe("demo-day.json", () => {
  it("has a viewer the website accepts, for the demo date", () => {
    const viewer = ViewerSchema.parse(fixture.viewer);
    expect(viewer.kind).toBe("demo");
    expect(viewer.clinicToday).toBe(fixture.meta.date);
    expect(viewer.role).toBeUndefined();
  });

  it("has the three sample staff, each marked as sample", () => {
    const staff = StaffListSchema.parse(fixture.staff);
    expect(staff.map((member) => member.displayName)).toEqual(["Ayesha Khan", "Bilal Raza", "Hina Siddiqui", "Omar Farooq", "Sana Malik"]);
    expect(staff.every((member) => member.isSample === true)).toBe(true);
  });

  it("has only sample bookings, sorted by time, with valid statuses and D references", () => {
    expect(fixture.bookings.length).toBeGreaterThan(20);
    const times = fixture.bookings.map((b: { startsAt: string }) => b.startsAt);
    expect(times).toEqual([...times].sort());
    for (const booking of fixture.bookings) {
      expect(booking.isSample).toBe(true);
      expect(booking.reference).toMatch(/^D[0-9A-HJKMNP-TV-Z]{9}$/);
      expect(BookingStatusSchema.safeParse(booking.status).success).toBe(true);
      expect(booking.patientNameMasked).toMatch(/^\S+ [A-Z]\.$/);
    }
  });

  it("splits the day by the fixed clock (11:20:45 in the clinic): confirmed after it, resolved before it", () => {
    const now = Date.parse(fixture.meta.now);
    expect(fixture.meta.now).toBe("2026-10-05T06:20:45Z");
    for (const booking of fixture.bookings) {
      const start = Date.parse(booking.startsAt);
      const end = Date.parse(booking.endsAt);
      if (booking.status === "cancelled") continue;
      if (end <= now) expect(["completed", "no_show"]).toContain(booking.status);
      else if (start <= now) expect(booking.status).toBe("arrived");
      else expect(booking.status).toBe("confirmed");
    }
  });
});
