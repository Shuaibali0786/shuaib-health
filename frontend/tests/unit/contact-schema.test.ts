import { describe, expect, it } from "vitest";
import { contactSchema, isValidContact, isValidEmail, isValidPhone, normalizePhone } from "@/lib/contactSchema";

const valid = { name: "Ayesha Khan", contact: "0300-0000000", subject: "Opening hours", message: "Are you open on Saturday evening?" };

function problems(input: Partial<Record<keyof typeof valid, string>>): Record<string, string> {
  const result = contactSchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  // The form shows the first problem for each field, so the tests do the same.
  const first: Record<string, string> = {};
  for (const issue of result.error.issues) first[String(issue.path[0])] ??= issue.message;
  return first;
}

describe("contactSchema", () => {
  it("accepts a complete, valid message and trims it", () => {
    const result = contactSchema.safeParse({ name: "  Ayesha Khan ", contact: " a@b.co ", subject: " Opening hours ", message: "  Are you open on Saturday?  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Ayesha Khan", contact: "a@b.co", subject: "Opening hours", message: "Are you open on Saturday?" });
    }
  });

  it("asks for every field when all are empty", () => {
    expect(problems({ name: "", contact: "", subject: "", message: "" })).toEqual({
      name: "Enter your name.",
      contact: "Enter a phone number or an email address.",
      subject: "Enter a subject.",
      message: "Enter your message.",
    });
  });

  it("treats whitespace-only fields as empty", () => {
    expect(problems({ name: "   ", contact: "\t", subject: " ", message: "\n\n" })).toEqual({
      name: "Enter your name.",
      contact: "Enter a phone number or an email address.",
      subject: "Enter a subject.",
      message: "Enter your message.",
    });
  });

  it("enforces the minimum and maximum lengths", () => {
    expect(problems({ name: "A" }).name).toMatch(/at least 2/);
    expect(problems({ name: "A".repeat(81) }).name).toMatch(/80 characters or fewer/);
    expect(problems({ name: "A".repeat(80) })).toEqual({});
    expect(problems({ subject: "Hi" }).subject).toMatch(/at least 3/);
    expect(problems({ subject: "S".repeat(101) }).subject).toMatch(/100 characters or fewer/);
    expect(problems({ message: "Too short" }).message).toMatch(/at least 10/);
    expect(problems({ message: "m".repeat(1001) }).message).toMatch(/1,000 characters or fewer/);
    expect(problems({ message: "m".repeat(1000) })).toEqual({});
  });

  it("measures length after trimming, so padding cannot satisfy the minimum", () => {
    expect(problems({ message: "   short   " }).message).toMatch(/at least 10/);
  });

  it("explains an invalid phone or email in one plain message", () => {
    expect(problems({ contact: "hello" }).contact).toMatch(/valid phone number.*or a valid email/);
    expect(problems({ contact: "12345" }).contact).toBeDefined();
    expect(problems({ contact: "a@b" }).contact).toBeDefined();
  });
});

describe("phone numbers", () => {
  it.each(["+92 300 0000000", "0300-0000000", "021 3000 0000", "(021) 3000 0000", "+92-21-3000-0000", "03000000000"])("accepts %s", (value) => {
    expect(isValidPhone(value)).toBe(true);
    expect(isValidContact(value)).toBe(true);
  });

  it.each(["", "abc", "123", "0300-000", "+92 300 0000000 99999", "03OO-0000000", "++923000000000"])("rejects %j", (value) => {
    expect(isValidPhone(value)).toBe(false);
  });

  it("normalises separators away", () => {
    expect(normalizePhone("+92 300-000 0000")).toBe("+923000000000");
    expect(normalizePhone("(021) 3000.0000")).toBe("02130000000");
  });
});

describe("email addresses", () => {
  it("accepts a normal address and rejects typos", () => {
    expect(isValidEmail("name@example.com")).toBe(true);
    expect(isValidEmail(" name@example.com ")).toBe(true);
    for (const bad of ["name", "name@", "@example.com", "name@example", "na me@example.com", "name@exa mple.com"]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });

  it("accepts either a phone or an email, never needs both", () => {
    expect(problems({ contact: "a@b.com" })).toEqual({});
    expect(problems({ contact: "0300-0000000" })).toEqual({});
  });
});
