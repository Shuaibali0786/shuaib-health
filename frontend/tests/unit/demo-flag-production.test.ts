// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoEnabled } from "@/lib/demo";

// On Vercel (production or preview) DEMO_ENABLED must be set explicitly; elsewhere the old defaults hold.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDemoEnabled on Vercel", () => {
  it.each(["production", "preview"])("fails the build when DEMO_ENABLED is missing in %s", (vercelEnv) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("DEMO_ENABLED", "");
    expect(() => isDemoEnabled()).toThrow(/DEMO_ENABLED/);
  });

  it("names the setting and nothing else in the error", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_ENABLED", "   ");
    expect(() => isDemoEnabled()).toThrow("DEMO_ENABLED must be set explicitly on Vercel (true or false).");
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("uses the explicit value %s", (value, expected) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("DEMO_ENABLED", value);
    expect(isDemoEnabled()).toBe(expected);
  });
});

describe("isDemoEnabled outside Vercel", () => {
  it("keeps today's default (on) when unset, with no Vercel environment", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("DEMO_ENABLED", "");
    expect(isDemoEnabled()).toBe(true);
  });

  it("keeps the default for local `vercel dev` (development)", () => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("DEMO_ENABLED", "");
    expect(isDemoEnabled()).toBe(true);
  });
});
