// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";
import { load } from "@/lib/api/load";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("load", () => {
  it("returns the data on success and logs nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(load("doctors", async () => [1, 2])).resolves.toEqual({ ok: true, data: [1, 2] });
    expect(warn).not.toHaveBeenCalled();
  });

  it("maps unconfigured to reason unconfigured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await load("doctors", async () => {
      throw new ApiError("unconfigured");
    });
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
  });

  it.each(["network", "timeout", "status", "invalid"] as const)("maps %s to reason unavailable", async (kind) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await load("doctors", async () => {
      throw new ApiError(kind, { status: kind === "status" ? 500 : undefined });
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("never throws, even on a non-ApiError", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      load("doctors", async () => {
        throw new Error("boom");
      }),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("logs exactly one JSON warning with event, resource, kind and requestId only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await load("lab-tests", async () => {
      throw new ApiError("timeout", { requestId: "req-9" });
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({
      event: "catalog_api_unavailable",
      resource: "lab-tests",
      kind: "timeout",
      requestId: "req-9",
    });
  });

  it("does not log a URL, query or body for a non-ApiError", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await load("doctors", async () => {
      throw new Error("GET http://secret.host/api/v1/doctors?q=private failed");
    });
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).not.toContain("secret.host");
    expect(line).not.toContain("private");
  });
});
