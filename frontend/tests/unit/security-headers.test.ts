// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PUBLIC_SITE_SOURCE,
  commonSecurityHeaders,
  publicSiteHeaders,
  securityHeadersMode,
} from "@/lib/security-headers";

const names = (list: { key: string }[]) => list.map((h) => h.key);

describe("securityHeadersMode", () => {
  it("is off locally when unset", () => {
    expect(securityHeadersMode({})).toBe("off");
  });

  it.each(["production", "preview"])("fails a %s build on Vercel when unset, naming the setting", (env) => {
    expect(() => securityHeadersMode({ VERCEL_ENV: env })).toThrow(/SITE_SECURITY_HEADERS/);
  });

  it.each(["off", "report", "enforce"])("accepts %s", (value) => {
    expect(securityHeadersMode({ VERCEL_ENV: "production", SITE_SECURITY_HEADERS: value })).toBe(value);
  });

  it("rejects an unknown value", () => {
    expect(() => securityHeadersMode({ SITE_SECURITY_HEADERS: "yes" })).toThrow(/SITE_SECURITY_HEADERS/);
  });
});

describe("header sets", () => {
  it("sends nothing when off", () => {
    expect(commonSecurityHeaders("off")).toEqual([]);
    expect(publicSiteHeaders("off")).toEqual([]);
  });

  it.each(["report", "enforce"] as const)("%s: HSTS without preload, nosniff, frame deny, permissions policy", (mode) => {
    const common = commonSecurityHeaders(mode);
    expect(names(common)).toEqual([
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Permissions-Policy",
    ]);
    expect(common[0]?.value).not.toMatch(/preload/i);
    expect(common.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
  });

  it("report mode uses Report-Only for the CSP, enforce mode the enforced header", () => {
    expect(names(publicSiteHeaders("report"))).toEqual(["Referrer-Policy", "Content-Security-Policy-Report-Only"]);
    expect(names(publicSiteHeaders("enforce"))).toEqual(["Referrer-Policy", "Content-Security-Policy"]);
  });

  it("never touches the staff Referrer-Policy or CSP: the public set skips /admin and /api/admin", () => {
    const re = new RegExp(`^${PUBLIC_SITE_SOURCE}$`);
    expect(re.test("/")).toBe(true);
    expect(re.test("/doctors/dr-x")).toBe(true);
    expect(re.test("/admin")).toBe(false);
    expect(re.test("/admin/login")).toBe(false);
    expect(re.test("/api/admin/session")).toBe(false);
    expect(re.test("/api/booking/slots")).toBe(true);
  });

});
