import { describe, expect, it } from "vitest";

import { qrModules, qrPath } from "@/lib/booking/qr";

describe("QR encoder", () => {
  const modules = qrModules("ABCDE-FGHJK");

  it("makes a version 1 symbol (21 x 21) for a booking reference", () => {
    expect(modules).toHaveLength(21);
    modules.forEach((row) => expect(row).toHaveLength(21));
  });

  it("draws the three finder patterns and the timing lines", () => {
    const finder = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
    for (const [ox, oy] of [[0, 0], [14, 0], [0, 14]] as const) {
      finder.forEach((line, dy) => line.split("").forEach((c, dx) => expect(modules[oy + dy]?.[ox + dx]).toBe(c === "1")));
    }
    for (let i = 8; i < 13; i++) {
      expect(modules[6]?.[i]).toBe(i % 2 === 0);
      expect(modules[i]?.[6]).toBe(i % 2 === 0);
    }
    expect(modules[13]?.[8]).toBe(true); // the always-dark module
  });

  it("is deterministic and depends on the text", () => {
    expect(qrModules("ABCDE-FGHJK")).toEqual(modules);
    expect(qrModules("ABCDE-FGHJM")).not.toEqual(modules);
  });

  it("grows to fit longer text and refuses text that cannot fit", () => {
    expect(qrModules("x".repeat(40))).toHaveLength(29); // version 3
    expect(() => qrModules("x".repeat(500))).toThrow(RangeError);
  });

  it("describes the dark modules as an SVG path", () => {
    const path = qrPath(modules, 2);
    expect(path.startsWith("M2 2h7")).toBe(true); // the top finder bar
    expect(path.match(/z/g)?.length).toBeGreaterThan(40);
  });
});
