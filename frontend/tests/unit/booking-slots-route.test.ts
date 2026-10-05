// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/booking/slots/[doctorSlug]/route";

const ORIGIN = "http://api.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";

const slots = {
  doctorSlug: "dr-omar-sheikh",
  timeZone: "Asia/Karachi",
  windowDays: 14,
  generatedAt: "2026-10-05T04:00:00Z",
  days: [
    {
      date: "2026-10-06",
      weekday: "tue",
      status: "available",
      slots: [{ startsAt: "2026-10-06T05:00:00Z", endsAt: "2026-10-06T05:15:00Z", localTime: "10:00" }],
    },
  ],
};

const errorBody = (code: string) => ({ error: { code, message: "m", requestId: "backend-1" } });

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

function call(slug: string, query = "", headers: Record<string, string> = {}) {
  const request = new Request(`http://site.test/api/booking/slots/${slug}${query}`, { headers });
  return GET(request, { params: Promise.resolve({ doctorSlug: slug }) });
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/booking/slots/[doctorSlug]", () => {
  it("forwards a valid request and returns the validated body with no-store", async () => {
    const fetchMock = vi.fn(async () => json(slots));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("dr-omar-sheikh", "?from=2026-10-06&days=3", { "x-forwarded-for": "203.0.113.9, 10.0.0.1" });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(slots);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/doctors/dr-omar-sheikh/slots?from=2026-10-06&days=3`);
    expect(init.headers).toMatchObject({ "x-proxy-secret": SECRET, "x-client-ip": "203.0.113.9" });
  });

  it("drops from and days when they are not valid, rather than forwarding them", async () => {
    const fetchMock = vi.fn(async () => json(slots));
    vi.stubGlobal("fetch", fetchMock);
    await call("dr-omar-sheikh", "?from=tomorrow&days=999&evil=1");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${ORIGIN}/api/v1/doctors/dr-omar-sheikh/slots`);
  });

  it("returns 404 for a slug that is not a slug, without calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const slug of ["Dr-Omar", "a/b", "..", "dr_omar", "-x", ""]) {
      const res = await call(slug);
      expect(res.status, slug).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([404, 422, 503])("passes a %i from the backend through", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(errorBody(status === 404 ? "not_found" : status === 422 ? "validation_error" : "service_unavailable"), { status })));
    const res = await call("dr-omar-sheikh");
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).error.requestId).toBe("backend-1");
  });

  it("passes a 429 through with Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(errorBody("rate_limited"), { status: 429, headers: { "retry-after": "30" } })));
    const res = await call("dr-omar-sheikh");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("answers 502 bad_gateway when a 200 body does not match the contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...slots, days: [{ date: "2026-10-06" }] })));
    const res = await call("dr-omar-sheikh");
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("bad_gateway");
  });

  it("answers 502 when an error status carries an unusable body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 429 })));
    expect((await call("dr-omar-sheikh")).status).toBe(502);
  });

  it("answers 503 service_unavailable on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const res = await call("dr-omar-sheikh");
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("service_unavailable");
  });

  it("answers 503 service_unavailable on a timeout", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(timeout)));
    expect((await call("dr-omar-sheikh")).status).toBe(503);
  });

  it("answers 503 when the proxy secret is not configured", async () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("dr-omar-sheikh");
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs no slug, address or body when it fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(errorBody("internal_error"), { status: 500 })));
    await call("dr-omar-sheikh", "", { "x-forwarded-for": "203.0.113.9" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("203.0.113.9");
    expect(logged).not.toContain(SECRET);
  });
});
