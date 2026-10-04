// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom } from "@/lib/booking/backend";

const ORIGIN = "http://api.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const PHONE = "03001234567";

const call = {
  method: "POST" as const,
  path: "/appointments" as const,
  body: { fullName: "Ali Khan", mobile: PHONE },
  idempotencyKey: "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b",
  clientIp: "203.0.113.9",
  requestId: "req-1",
  timeoutMs: 1000,
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" }, ...init });
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected callBooking to throw");
}

let consoleSpies: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  consoleSpies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const spy of consoleSpies) spy.mockRestore();
});

describe("callBooking", () => {
  it("forwards the secret, the client address, the request id and the idempotency key", async () => {
    const fetchMock = vi.fn(async () => json({ reference: "ABCDE-FGHJK" }, { headers: { "x-request-id": "backend-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callBooking(call);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/appointments`);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({
      "x-proxy-secret": SECRET,
      "x-client-ip": "203.0.113.9",
      "x-request-id": "req-1",
      "idempotency-key": call.idempotencyKey,
      "content-type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual(call.body);
    expect(result).toEqual({ status: 201, body: { reference: "ABCDE-FGHJK" }, retryAfter: undefined, requestId: "backend-1" });
  });

  it("sends no body and no idempotency key on a GET", async () => {
    const fetchMock = vi.fn(async () => json({}, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await callBooking({ method: "GET", path: "/appointments/ABCDEFGHJK", clientIp: "203.0.113.9", requestId: "r", timeoutMs: 1000 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("idempotency-key");
    expect(init.headers).not.toHaveProperty("content-type");
  });

  it("hands back non-2xx answers, including Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "rate_limited" } }, { status: 429, headers: { "retry-after": "60" } })));
    const result = await callBooking(call);
    expect(result.status).toBe(429);
    expect(result.retryAfter).toBe("60");
    expect(result.body).toEqual({ error: { code: "rate_limited" } });
  });

  it("keeps a non-JSON body as null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 })));
    expect((await callBooking(call)).body).toBeNull();
  });

  it("maps a timeout to ApiError('timeout')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal?.reason)))),
    );
    expect((await errorOf(callBooking({ ...call, timeoutMs: 20 }))).kind).toBe("timeout");
  });

  it("maps a network failure to ApiError('network')", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await errorOf(callBooking(call))).kind).toBe("network");
  });

  it("throws ApiError('unconfigured') without the secret or without the API address", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("BOOKING_PROXY_SECRET", "too-short");
    expect((await errorOf(callBooking(call))).kind).toBe("unconfigured");

    vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
    vi.stubEnv("CATALOG_API_URL", "");
    expect((await errorOf(callBooking(call))).kind).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never logs a body, a phone number or a header value", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "internal_error", message: PHONE } }, { status: 500, headers: { "x-request-id": "backend-9" } })));
    await callBooking({ ...call, path: "/appointments/ABCDEFGHJK" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await errorOf(callBooking(call));

    const logged = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
    expect(logged).toContain("/appointments/{reference}");
    expect(logged).toContain("internal_error");
    expect(logged).toContain("backend-9");
    for (const secret of [PHONE, "Ali Khan", SECRET, "203.0.113.9", call.idempotencyKey, "ABCDEFGHJK"]) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe("clientIpFrom", () => {
  it("takes the first valid x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "junk, 2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "not-an-ip", "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIpFrom(new Headers())).toBe("unknown");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "999.1.1.1" }))).toBe("unknown");
  });
});
