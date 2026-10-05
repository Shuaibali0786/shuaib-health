// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/booking/appointments/route";

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const KEY = "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b";

const booking = {
  doctorSlug: "dr-omar-sheikh",
  startsAt: "2026-10-06T09:00:00Z",
  fullName: "Ali Khan",
  mobile: "0300 1234567",
  email: "ali@example.com",
  reason: "Private reason",
  acceptRules: true,
  trap: "",
};

const view = {
  reference: "ABCDE-FGHJK",
  status: "confirmed",
  doctor: { slug: "dr-omar-sheikh", fullName: "Dr. Omar Sheikh", specialty: "Orthopedics" },
  department: { slug: "orthopedics", name: "Orthopedics" },
  startsAt: "2026-10-06T09:00:00Z",
  endsAt: "2026-10-06T09:15:00Z",
  localDate: "2026-10-06",
  localTime: "14:00",
  timeZone: "Asia/Karachi",
  feePkr: 2500,
  patientNameMasked: "A**** K****",
  mobileMasked: "0300****567",
  bookedAt: "2026-10-04T09:05:00Z",
  isSample: true,
};

const error = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: "m", requestId: "backend-1" },
  ...extra,
});

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" }, ...init });
}

function post(over: { body?: unknown; raw?: string; headers?: Record<string, string | null> } = {}) {
  const headers: Record<string, string> = {
    origin: SITE,
    "content-type": "application/json",
    "idempotency-key": KEY,
    "x-forwarded-for": "203.0.113.9",
  };
  for (const [name, value] of Object.entries(over.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  return POST(
    new Request(`${SITE}/api/booking/appointments`, {
      method: "POST",
      headers,
      body: over.raw ?? JSON.stringify(over.body ?? booking),
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/booking/appointments: guards", () => {
  it("refuses a missing Origin, a foreign Origin and a cross-site request with 403", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cases: Record<string, string | null>[] = [{ origin: null }, { origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }];
    for (const headers of cases) {
      const res = await post({ headers });
      expect(res.status, JSON.stringify(headers)).toBe(403);
      expect((await res.json()).error.code).toBe("forbidden");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a same-origin request, with or without Sec-Fetch-Site", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(view)));
    expect((await post({ headers: { "sec-fetch-site": "same-origin" } })).status).toBe(201);
    expect((await post()).status).toBe(201);
  });

  it("refuses a body that is not JSON with 415", async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      expect((await post({ headers: { "content-type": type } })).status, type).toBe(415);
    }
    expect((await post({ headers: { "content-type": null } })).status).toBe(415);
  });

  it("refuses a body over 4 KB with 413", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await post({ body: { ...booking, reason: "x".repeat(5000) } });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not valid JSON, with 422", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await post({ raw: "{not json" })).status).toBe(422);
  });

  it("refuses a missing or malformed Idempotency-Key with 422", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const key of [null, "", "not-a-uuid", "4d6f0a52-5c1f-1a0e-9a47-0c1d2e3f4a5b"]) {
      const res = await post({ headers: { "idempotency-key": key } });
      expect(res.status, String(key)).toBe(422);
      expect((await res.json()).error.details[0].field).toBe("idempotencyKey");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/booking/appointments: forwarding", () => {
  it("forwards the body, the secret, the client address, a request id and the key", async () => {
    const fetchMock = vi.fn(async () => json(view));
    vi.stubGlobal("fetch", fetchMock);

    await post();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/appointments`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(booking);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-proxy-secret"]).toBe(SECRET);
    expect(headers["x-client-ip"]).toBe("203.0.113.9");
    expect(headers["idempotency-key"]).toBe(KEY);
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the validated 201 body with no-store", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(view)));
    const res = await post();
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(view);
  });
});

describe("POST /api/booking/appointments: pass-through", () => {
  it.each([
    [409, error("slot_taken", { alternatives: [{ startsAt: "2026-10-06T09:15:00Z", endsAt: "2026-10-06T09:30:00Z", localDate: "2026-10-06", localTime: "14:15" }] })],
    [409, error("booking_limit_reached")],
    [422, { error: { code: "validation_error", message: "m", requestId: "r", details: [{ field: "mobile", issue: "is invalid" }] } }],
    [400, error("request_rejected")],
    [403, error("forbidden")],
    [503, error("service_unavailable")],
  ])("passes a %i through unchanged", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(body, { status })));
    const res = await post();
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(body);
  });

  it("passes a 429 through and keeps Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(error("rate_limited"), { status: 429, headers: { "retry-after": "60" } })));
    const res = await post();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("answers 502 bad_gateway when a 201 body does not match the contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...view, reference: undefined })));
    const res = await post();
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("bad_gateway");
  });

  it("answers 502 for an error status with an unusable body, and for unexpected statuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 409 })));
    expect((await post()).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => json(error("internal_error"), { status: 500 })));
    expect((await post()).status).toBe(502);
  });

  it("answers 504 timeout when the backend takes too long", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(timeout)));
    const res = await post();
    expect(res.status).toBe(504);
    expect((await res.json()).error.code).toBe("timeout");
  });

  it("answers 503 service_unavailable when the backend cannot be reached or is not configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await post()).status).toBe(503);
    vi.stubEnv("BOOKING_PROXY_SECRET", "");
    const res = await post();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("service_unavailable");
  });
});

describe("POST /api/booking/appointments: logging", () => {
  it("logs no body, name, mobile, key or address, even when the backend fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(error("internal_error"), { status: 500 })));
    await post();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await post();
    const logged = JSON.stringify(
      (["log", "info", "warn", "error"] as const).flatMap((method) => vi.mocked(console[method]).mock.calls),
    );
    for (const secret of ["Ali Khan", "0300", "ali@example.com", "Private reason", KEY, "203.0.113.9", SECRET]) {
      expect(logged, secret).not.toContain(secret);
    }
  });
});
