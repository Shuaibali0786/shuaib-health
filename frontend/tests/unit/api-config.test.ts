// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { getProxySecret } from "@/lib/api/config";

const SECRET = "fake-unit-test-proxy-secret-0123456789";

describe("getProxySecret", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the trimmed secret when it is at least 32 characters", () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", `  ${SECRET}\n`);
    expect(getProxySecret()).toBe(SECRET);
    vi.stubEnv("BOOKING_PROXY_SECRET", "x".repeat(32));
    expect(getProxySecret()).toBe("x".repeat(32));
  });

  it("returns null when it is missing, empty or too short", () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", undefined);
    expect(getProxySecret()).toBeNull();
    vi.stubEnv("BOOKING_PROXY_SECRET", "");
    expect(getProxySecret()).toBeNull();
    vi.stubEnv("BOOKING_PROXY_SECRET", "   ");
    expect(getProxySecret()).toBeNull();
    vi.stubEnv("BOOKING_PROXY_SECRET", "x".repeat(31));
    expect(getProxySecret()).toBeNull();
  });

  it("never echoes the value to the console", () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    vi.stubEnv("BOOKING_PROXY_SECRET", "short-secret-value");
    getProxySecret();
    vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
    getProxySecret();
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain("short-secret-value");
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
      spy.mockRestore();
    }
  });
});
