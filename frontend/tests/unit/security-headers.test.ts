// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PUBLIC_SITE_SOURCE,
  commonSecurityHeaders,
  cspReportUri,
  publicSiteHeaders,
  securityHeadersMode,
  staffCspHeaders,
} from "@/lib/security-headers";

const names = (list: { key: string }[]) => list.map((h) => h.key);

describe("cspReportUri", () => {
  const good = "https://o1.ingest.sentry.io/api/2/security/?sentry_key=abc";
  it("is undefined when unset or blank", () => {
    expect(cspReportUri({})).toBeUndefined();
    expect(cspReportUri({ CSP_REPORT_URI: "  " })).toBeUndefined();
  });
  it("accepts a plain https URL", () => {
    expect(cspReportUri({ CSP_REPORT_URI: good })).toBe(good);
  });
  it.each(["http://example.com/r", "not a url", "https://x.test/r; script-src *", "https://x.test/r,y", "ftp://x.test"])(
    "rejects %s without echoing it",
    (value) => {
      expect(() => cspReportUri({ CSP_REPORT_URI: value })).toThrow(/CSP_REPORT_URI/);
      try {
        cspReportUri({ CSP_REPORT_URI: value });
      } catch (error) {
        expect(String(error)).not.toContain(value);
      }
    },
  );
});

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

  it("the microphone is blocked unless voice is on, and then only for this site itself", () => {
    const policy = (options?: { microphone?: boolean }) => commonSecurityHeaders("enforce", options).find((h) => h.key === "Permissions-Policy")?.value;
    expect(policy()).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    expect(policy({ microphone: true })).toBe("camera=(), microphone=(self), geolocation=(), payment=(), usb=()");
    expect(commonSecurityHeaders("off", { microphone: true })).toEqual([]);
  });

  it("report mode uses Report-Only for the CSP, enforce mode the enforced header", () => {
    expect(names(publicSiteHeaders("report"))).toEqual(["Referrer-Policy", "Content-Security-Policy-Report-Only"]);
    expect(names(publicSiteHeaders("enforce"))).toEqual(["Referrer-Policy", "Content-Security-Policy"]);
  });

  it("adds report-uri to the policy only when given, and stays Report-Only in report mode", () => {
    const uri = "https://o1.ingest.sentry.io/api/2/security/?sentry_key=abc";
    const withUri = publicSiteHeaders("report", uri);
    const csp = withUri.find((h) => h.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    expect(csp.endsWith(`; report-uri ${uri}`)).toBe(true);
    expect(names(withUri)).not.toContain("Content-Security-Policy");
    const without = publicSiteHeaders("report").find((h) => h.key === "Content-Security-Policy-Report-Only")?.value ?? "";
    expect(without).not.toContain("report-uri");
  });

  it("lets the contact page frame OpenStreetMap only, and nothing else", () => {
    for (const mode of ["report", "enforce"] as const) {
      const csp = publicSiteHeaders(mode).find((h) => h.key.startsWith("Content-Security-Policy"))?.value ?? "";
      expect(csp).toContain("frame-src https://www.openstreetmap.org;");
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toMatch(/unsafe-eval/);
    }
  });

  it("staff CSP: framing only when off, plus a Report-Only script policy in report mode, the full policy when enforced", () => {
    expect(staffCspHeaders("off")).toEqual([{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }]);

    const report = staffCspHeaders("report", "https://o1.ingest.sentry.io/api/2/security/?sentry_key=abc");
    expect(names(report)).toEqual(["Content-Security-Policy", "Content-Security-Policy-Report-Only"]);
    expect(report[0]?.value).toBe("frame-ancestors 'none'");
    expect(report[1]?.value).toContain("script-src 'self' 'unsafe-inline'");
    expect(report[1]?.value).toContain("report-uri https://o1.ingest.sentry.io/");

    const enforce = staffCspHeaders("enforce");
    expect(names(enforce)).toEqual(["Content-Security-Policy"]);
    const csp = enforce[0]?.value ?? "";
    for (const part of ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
      expect(csp).toContain(part);
    }
    expect(csp).not.toMatch(/unsafe-eval|frame-src|https?:\/\//);
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

describe("Feature 013: the premium voice provider's CSP", () => {
  it("adds only the speech service domains and blob audio, and only when the premium voice is on", () => {
    const csp = (speech: boolean) => publicSiteHeaders("enforce", undefined, { speech }).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp(false)).toContain("connect-src 'self';");
    expect(csp(false)).not.toContain("speech.microsoft.com");
    expect(csp(false)).not.toContain("media-src");
    expect(csp(true)).toContain("connect-src 'self' https://*.tts.speech.microsoft.com wss://*.tts.speech.microsoft.com wss://*.stt.speech.microsoft.com;");
    expect(csp(true)).toContain("media-src 'self' blob:");
    expect(csp(true)).toContain("default-src 'self'");
    expect(csp(true)).toContain("frame-ancestors 'none'");
  });
});
