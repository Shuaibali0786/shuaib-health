import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DetailsFormSchema } from "@/lib/booking/form";
import { normalizePkMobile } from "@/lib/booking/phone";

type Case = { input: string; normalized: string | null };

// The same table drives the backend test, so the browser and the server cannot drift apart.
const { cases } = JSON.parse(
  readFileSync(resolve(process.cwd(), "../specs/005-appointment-booking/contracts/fixtures/phone-cases.json"), "utf8"),
) as { cases: Case[] };

describe("normalizePkMobile", () => {
  it("has cases to run", () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  it.each(cases.map((c) => [c.input === "" ? "<empty>" : c.input, c] as const))("%s", (_label, { input, normalized }) => {
    expect(normalizePkMobile(input)).toBe(normalized);
  });
});

const valid = {
  fullName: "Ali Khan",
  mobile: "0300 1234567",
  email: "",
  reason: "",
  acceptRules: true as const,
  trap: "",
};

function messages(input: Record<string, unknown>): Record<string, string> {
  const result = DetailsFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe("DetailsFormSchema", () => {
  it("accepts a complete form and keeps optional fields optional", () => {
    expect(DetailsFormSchema.safeParse(valid).success).toBe(true);
    expect(DetailsFormSchema.safeParse({ ...valid, email: "ali@example.com", reason: "Checkup" }).success).toBe(true);
  });

  it("accepts names in any script, with apostrophes and hyphens", () => {
    for (const fullName of ["علی خان", "Shaista O'Brien", "Anne-Marie", "  Ali Khan  "]) {
      expect(messages({ ...valid, fullName }), fullName).toEqual({});
    }
  });

  it("rejects bad names with a friendly message", () => {
    for (const fullName of ["A", "", "Ali 2", "<b>x</b>", "x".repeat(81)]) {
      expect(messages({ ...valid, fullName }).fullName, fullName).toMatch(/full name/i);
    }
  });

  it("rejects a mobile number that is not Pakistani, with an example", () => {
    expect(messages({ ...valid, mobile: "02134567890" }).mobile).toMatch(/Pakistani mobile/);
    expect(messages({ ...valid, mobile: "" }).mobile).toMatch(/Pakistani mobile/);
  });

  it("rejects a bad email but allows an empty one", () => {
    expect(messages({ ...valid, email: "nope" }).email).toMatch(/email/i);
    expect(messages({ ...valid, email: "" })).toEqual({});
  });

  it("limits the reason to 300 characters", () => {
    expect(messages({ ...valid, reason: "x".repeat(300) })).toEqual({});
    expect(messages({ ...valid, reason: "x".repeat(301) }).reason).toMatch(/300/);
  });

  it("requires the rules to be accepted, with the exact message", () => {
    expect(messages({ ...valid, acceptRules: false }).acceptRules).toBe("Please accept the clinic rules to continue.");
    expect(messages({ ...valid, acceptRules: undefined }).acceptRules).toBe("Please accept the clinic rules to continue.");
  });
});
