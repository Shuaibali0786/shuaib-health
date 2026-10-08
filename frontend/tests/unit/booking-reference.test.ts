import { describe, expect, it } from "vitest";

import { displayReference, parseReference } from "@/lib/booking/reference";

describe("parseReference", () => {
  it.each(["ABCDEFGHJK", "abcdefghjk", "ABCDE-FGHJK", "abcde-fghjk", " ABCDE FGHJK "])("accepts %s", (text) => {
    expect(parseReference(text)).toBe("ABCDEFGHJK");
  });

  it.each(["", "ABCDEFGHJ", "ABCDEFGHJKL", "ABCDEFGHIK", "ABCDEFGHLK", "ABCDEFGHOK", "ABCDEFGHUK", "../etc/passwd", "ABCDE-FGHJ!"])(
    "rejects %s",
    (text) => {
      expect(parseReference(text)).toBeNull();
    },
  );
});

describe("references issued before the look-alike rule", () => {
  it.each(["0123456789", "ABCD0E1FGH", "abcd0e1fgh", "ABCD0-E1FGH"])("stay valid and case-insensitive: %s", (text) => {
    expect(parseReference(text)).toBe(text.replace("-", "").toUpperCase());
  });
});

describe("displayReference", () => {
  it("groups in fives", () => {
    expect(displayReference("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
  });
});
