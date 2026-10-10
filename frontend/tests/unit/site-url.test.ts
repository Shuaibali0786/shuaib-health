// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "@/lib/seo";

// Order: SITE_URL, then the Vercel-provided host, then (off Vercel only) localhost.

beforeEach(() => {
  for (const name of ["SITE_URL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) {
    vi.stubEnv(name, "");
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl off Vercel", () => {
  it("falls back to localhost for local runs, tests and CI", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("uses SITE_URL and strips trailing slashes", () => {
    vi.stubEnv("SITE_URL", "https://example.test//");
    expect(siteUrl()).toBe("https://example.test");
  });
});

describe("siteUrl on Vercel", () => {
  it("prefers SITE_URL", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SITE_URL", "https://clinic.example.test");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "shuaib-health-web.vercel.app");
    expect(siteUrl()).toBe("https://clinic.example.test");
  });

  it("uses the production domain in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "shuaib-health-web.vercel.app");
    vi.stubEnv("VERCEL_URL", "shuaib-health-web-abc123.vercel.app");
    expect(siteUrl()).toBe("https://shuaib-health-web.vercel.app");
  });

  it("uses the deployment URL in a preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "shuaib-health-web.vercel.app");
    vi.stubEnv("VERCEL_URL", "shuaib-health-web-abc123.vercel.app");
    expect(siteUrl()).toBe("https://shuaib-health-web-abc123.vercel.app");
  });

  it("tolerates a scheme already present in the Vercel value", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "https://shuaib-health-web.vercel.app/");
    expect(siteUrl()).toBe("https://shuaib-health-web.vercel.app");
  });

  it("fails the production build when nothing resolves", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => siteUrl()).toThrow(/SITE_URL/);
  });

  it("never falls back to localhost on a preview either", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => siteUrl()).toThrow(/SITE_URL/);
  });

  it.each(["http://clinic.example.test", "https://localhost:3000", "https://127.0.0.1", "http://localhost"])(
    "refuses SITE_URL=%s",
    (value) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("SITE_URL", value);
      expect(() => siteUrl()).toThrow(/https/);
    },
  );
});
