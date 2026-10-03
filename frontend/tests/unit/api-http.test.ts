// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getApiBase, getClinicFallback, getDataRevalidateSeconds } from "@/lib/api/config";
import { ApiError, getJson } from "@/lib/api/http";

const Item = z.object({ name: z.string() });
const ORIGIN = "http://api.test";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected getJson to throw");
}

/** A fetch that never answers but rejects when its signal aborts, like the real one. */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  });
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getJson", () => {
  it("returns parsed data on a valid 200 and calls the versioned URL with no-store", async () => {
    const fetchMock = vi.fn(async () => json({ name: "ok", extra: "stripped" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getJson("/clinic", Item)).resolves.toEqual({ name: "ok" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/clinic`);
    expect(init.cache).toBe("no-store");
  });

  it("throws unconfigured, without calling fetch, when the URL is unset", async () => {
    vi.stubEnv("CATALOG_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await errorOf(getJson("/clinic", Item))).kind).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a URL with an invalid scheme as unconfigured", async () => {
    vi.stubEnv("CATALOG_API_URL", "ftp://api.test");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await errorOf(getJson("/clinic", Item))).kind).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a rejected fetch to network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await errorOf(getJson("/clinic", Item))).kind).toBe("network");
  });

  it("maps a hang past 3000 ms to timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    vi.stubGlobal("fetch", hangingFetch());
    const pending = errorOf(getJson("/clinic", Item));
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).kind).toBe("timeout");
    expect(AbortSignal.timeout).toHaveBeenCalledWith(3000);
  });

  it.each([404, 429, 500])("maps HTTP %i to status with the code", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {} }, { status })));
    const error = await errorOf(getJson("/clinic", Item));
    expect(error.kind).toBe("status");
    expect(error.status).toBe(status);
  });

  it("maps a schema-invalid 200 body to invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ name: 42 })));
    expect((await errorOf(getJson("/clinic", Item))).kind).toBe("invalid");
  });

  it("maps a non-JSON 200 body to invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect((await errorOf(getJson("/clinic", Item))).kind).toBe("invalid");
  });

  it("copies the request id from X-Request-ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, { status: 500, headers: { "x-request-id": "req-123" } })));
    expect((await errorOf(getJson("/clinic", Item))).requestId).toBe("req-123");
  });

  it("uses a caller-supplied signal instead of the default 3000 ms one", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn(async () => json({ name: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await getJson("/clinic", Item, signal);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBe(signal);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});

describe("getApiBase", () => {
  it("returns the origin without a trailing slash", () => {
    vi.stubEnv("CATALOG_API_URL", "https://api.example.com/");
    expect(getApiBase()).toBe("https://api.example.com");
  });

  it("returns null when unset", () => {
    vi.stubEnv("CATALOG_API_URL", "");
    expect(getApiBase()).toBeNull();
  });

  it("returns null and warns once for an invalid value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("CATALOG_API_URL", "not a url");
    expect(getApiBase()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reads the variable at call time", () => {
    vi.stubEnv("CATALOG_API_URL", "http://a.test");
    expect(getApiBase()).toBe("http://a.test");
    vi.stubEnv("CATALOG_API_URL", "http://b.test");
    expect(getApiBase()).toBe("http://b.test");
  });
});

describe("getClinicFallback", async () => {
  const clinic = JSON.stringify((await import("../fixtures/api/clinic.json")).default);

  it("returns validated settings", () => {
    vi.stubEnv("CLINIC_FALLBACK_JSON", clinic);
    expect(getClinicFallback()?.name).toBe("Shuaib Health");
  });

  it("returns null when missing", () => {
    vi.stubEnv("CLINIC_FALLBACK_JSON", "");
    expect(getClinicFallback()).toBeNull();
  });

  it("returns null and warns once, without echoing the value, when invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("CLINIC_FALLBACK_JSON", '{"name":"secret-looking-value"}');
    expect(getClinicFallback()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("secret-looking-value");
  });

  it("returns null and warns for malformed JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("CLINIC_FALLBACK_JSON", "{nope");
    expect(getClinicFallback()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getDataRevalidateSeconds", () => {
  it("defaults to 300", () => {
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", "");
    expect(getDataRevalidateSeconds()).toBe(300);
  });

  it("accepts an integer from 1 to 3600", () => {
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", "3");
    expect(getDataRevalidateSeconds()).toBe(3);
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", "3600");
    expect(getDataRevalidateSeconds()).toBe(3600);
  });

  it.each(["0", "3601", "1.5", "abc", "-4"])("falls back to 300 with one warning for %s", (value) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("CATALOG_DATA_REVALIDATE_SECONDS", value);
    expect(getDataRevalidateSeconds()).toBe(300);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
