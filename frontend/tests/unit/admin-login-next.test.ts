import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/admin/lib/nextPath";
import { generateTempPassword } from "@/admin/lib/tempPassword";

describe("safeNextPath (open-redirect guard)", () => {
  it.each(["/admin", "/admin/", "/admin/bookings", "/admin/account/password", "/admin/doctors"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example/admin",
    "//evil.example",
    "/\\evil.example",
    "/admin//evil.example",
    "/admin/../../etc",
    "/admin/%2e%2e/x",
    "/admin?next=//evil",
    "/admin/bookings?status=confirmed",
    "/administrator",
    "/other",
    "javascript:alert(1)",
    "admin",
    "",
  ])("rejects %s", (path) => {
    expect(safeNextPath(path)).toBe("/admin");
  });

  it("handles a missing value and a repeated parameter", () => {
    expect(safeNextPath(undefined)).toBe("/admin");
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath(["/admin/bookings", "https://evil.example"])).toBe("/admin/bookings");
    expect(safeNextPath(["https://evil.example", "/admin/bookings"])).toBe("/admin");
  });
});

describe("generateTempPassword", () => {
  it("is four dash-separated groups of four unambiguous characters", () => {
    for (let i = 0; i < 50; i += 1) expect(generateTempPassword()).toMatch(/^[a-hj-km-np-z2-9]{4}(-[a-hj-km-np-z2-9]{4}){3}$/);
  });

  it("differs every time", () => {
    expect(new Set(Array.from({ length: 100 }, () => generateTempPassword())).size).toBe(100);
  });

  it("skips biased bytes and asks for more randomness when it runs out", () => {
    let calls = 0;
    const fill = (bytes: Uint8Array) => {
      calls += 1;
      bytes.fill(255); // 255 is rejected: only the first four bytes of each buffer are usable
      bytes.set([0, 1, 2, 3], 0);
      return bytes;
    };
    expect(generateTempPassword(fill)).toBe("abcd-abcd-abcd-abcd");
    expect(calls).toBe(4);
  });
});
