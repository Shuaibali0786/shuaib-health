import { describe, expect, expectTypeOf, it } from "vitest";
import type * as z from "zod";

import type { components } from "@/lib/api/schema.gen";
import { BookingStatusSchema, ErrorResponseSchema, RoleSchema, ViewerSchema } from "@/admin/lib/schemas";

type Schemas = components["schemas"];

describe("admin schemas match the contract", () => {
  it("infer exactly the generated types", () => {
    expectTypeOf<z.infer<typeof RoleSchema>>().toEqualTypeOf<Schemas["Role"]>();
    expectTypeOf<z.infer<typeof BookingStatusSchema>>().toEqualTypeOf<Schemas["BookingStatus"]>();
    expectTypeOf<z.infer<typeof ViewerSchema>>().toEqualTypeOf<Schemas["Viewer"]>();
    expect(true).toBe(true);
  });

  const staff = {
    kind: "staff",
    role: "receptionist",
    displayName: "Sample Receptionist A",
    mustChangePassword: false,
    csrfToken: "tok",
    clinicToday: "2026-10-05",
    timezone: "Asia/Karachi",
    sessionExpiresAt: "2026-10-05T07:00:00Z",
  };

  it("parses a staff viewer and a demo viewer", () => {
    expect(ViewerSchema.safeParse(staff).success).toBe(true);
    const demo = { kind: "demo", csrfToken: staff.csrfToken, clinicToday: staff.clinicToday, timezone: staff.timezone };
    expect(ViewerSchema.safeParse(demo).success).toBe(true);
  });

  it("strips unknown keys, so a token can never ride along", () => {
    const parsed = ViewerSchema.parse({ ...staff, token: "cs_secret", extra: 1 });
    expect(parsed).not.toHaveProperty("token");
    expect(parsed).not.toHaveProperty("extra");
  });

  it.each([
    ["a missing csrfToken", { ...staff, csrfToken: undefined }],
    ["an unknown kind", { ...staff, kind: "owner" }],
    ["an unknown role", { ...staff, role: "doctor" }],
    ["a malformed date", { ...staff, clinicToday: "05/10/2026" }],
    ["a non-boolean flag", { ...staff, mustChangePassword: "no" }],
  ])("rejects %s", (_label, value) => {
    expect(ViewerSchema.safeParse(value).success).toBe(false);
  });

  it("knows the five booking statuses and nothing else", () => {
    expect(BookingStatusSchema.options).toEqual(["confirmed", "arrived", "completed", "no_show", "cancelled"]);
  });

  it("parses the Feature 006 error codes", () => {
    for (const code of ["not_signed_in", "session_expired", "csrf_failed", "demo_read_only", "booking_changed", "last_admin"]) {
      expect(ErrorResponseSchema.safeParse({ error: { code, message: "m", requestId: "r" } }).success, code).toBe(true);
    }
  });
});
