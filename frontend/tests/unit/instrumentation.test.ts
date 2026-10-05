// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { register } from "@/instrumentation";

const SECRET = "fake-unit-test-proxy-secret-0123456789";
const MESSAGE = "BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start";

describe("instrumentation register()", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    consoleError.mockRestore();
  });

  it("production + missing secret: refuses to start", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_PROXY_SECRET", undefined);
    await expect(register()).rejects.toThrow(MESSAGE);
  });

  it("production + short secret: refuses to start without echoing it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_PROXY_SECRET", "too-short-secret");
    const error = await register().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(MESSAGE);
    expect((error as Error).message).not.toContain("too-short-secret");
  });

  it("production + valid secret: starts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("development + missing secret: only logs", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BOOKING_PROXY_SECRET", undefined);
    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(MESSAGE);
  });

  it("build phase: never throws", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("BOOKING_PROXY_SECRET", undefined);
    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("edge runtime: does nothing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("BOOKING_PROXY_SECRET", undefined);
    await expect(register()).resolves.toBeUndefined();
  });
});
