// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH, POST } from "@/app/api/admin/[...path]/route";
import { ADMIN_ROUTES, matchAdminRoute, type AdminRoute } from "@/admin/lib/bffRoutes";

// Website BFF matrix of specs/006-clinic-command-centre/contracts/auth-matrix.md.

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const REF = "ABCDEFGHJK";
const ID = "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b";
const COOKIE = "__Host-cc_session=cs_fake-session-token";

const concrete = (route: AdminRoute) => route.browser.replace("{ref}", REF).replace("{id}", ID);
const handlers = { GET, POST, PATCH };

function call(route: AdminRoute, over: { headers?: Record<string, string | null>; body?: string; path?: string } = {}) {
  const headers: Record<string, string> = { cookie: COOKIE, "x-forwarded-for": "203.0.113.9" };
  if (route.method !== "GET") {
    headers.origin = SITE;
    if (route.bodyLimit > 0) headers["content-type"] = "application/json";
  }
  for (const [name, value] of Object.entries(over.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  const path = over.path ?? concrete(route);
  const init: RequestInit = { method: route.method, headers };
  if (route.method !== "GET") init.body = over.body ?? (route.bodyLimit > 0 ? "{}" : undefined);
  return handlers[route.method](new Request(`${SITE}/api/admin/${path}`, init), {
    params: Promise.resolve({ path: path.split("?")[0]!.split("/") }),
  } as never);
}

const okJson = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  fetchMock = vi.fn(async () => okJson({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("allow-list table", () => {
  it("lists the 15 routes of the contract, each at most once per method", () => {
    expect(ADMIN_ROUTES).toHaveLength(15);
    const keys = ADMIN_ROUTES.map((r) => `${r.method} ${r.browser}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches a route to its backend path and fills the placeholders", () => {
    expect(matchAdminRoute("GET", ["bookings", REF])?.backendPath).toBe(`/admin/bookings/${REF}`);
    expect(matchAdminRoute("PATCH", ["staff", ID])?.backendPath).toBe(`/admin/staff/${ID}`);
    expect(matchAdminRoute("POST", ["bookings", REF, "status", "undo"])?.backendPath).toBe(`/admin/bookings/${REF}/status/undo`);
  });

  it("is a miss for the wrong method, an unknown path, a bad reference or a bad id", () => {
    expect(matchAdminRoute("DELETE", ["staff", ID])).toBeNull();
    expect(matchAdminRoute("GET", ["bookings", REF, "status"])).toBeNull();
    expect(matchAdminRoute("GET", ["secret"])).toBeNull();
    expect(matchAdminRoute("GET", ["bookings", "abc"])).toBeNull();
    expect(matchAdminRoute("GET", ["bookings", "ABCDEFGHIK"])).toBeNull(); // I is not in the alphabet
    expect(matchAdminRoute("PATCH", ["staff", "not-a-uuid"])).toBeNull();
    expect(matchAdminRoute("GET", ["bookings", "../me"])).toBeNull();
  });

  it("keeps only validated query parameters and flags invalid ones", () => {
    expect(matchAdminRoute("GET", ["insights"], "range=30&evil=1")?.backendPath).toBe("/admin/insights?range=30");
    expect(matchAdminRoute("GET", ["insights"], "range=5")?.invalid).toEqual(["range"]);
    expect(matchAdminRoute("GET", ["activity"], `staffId=${ID}&page=2&action=booking.status_changed`)?.invalid).toEqual([]);
    expect(matchAdminRoute("GET", ["activity"], "staffId=x&page=0")?.invalid.sort()).toEqual(["page", "staffId"]);
  });
});

describe.each(ADMIN_ROUTES.map((route) => [`${route.method} /api/admin/${route.browser}`, route] as const))("%s", (_label, route) => {
  it("answers 401 without a session cookie and never calls the backend", async () => {
    const response = await call(route, { headers: { cookie: null } });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("not_signed_in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the session, the proxy secret and the client address", async () => {
    const response = await call(route, { headers: route.method === "GET" ? { "x-csrf-token": "csrf-1" } : { "x-csrf-token": "csrf-1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url).startsWith(`${ORIGIN}/api/v1/admin/`)).toBe(true);
    expect(init.method).toBe(route.method);
    expect(init.headers).toMatchObject({
      "x-proxy-secret": SECRET,
      "x-session-token": "cs_fake-session-token",
      "x-client-ip": "203.0.113.9",
      "x-csrf-token": "csrf-1",
    });
  });

  if (route.method !== "GET") {
    it("refuses a cross-site Origin with 403", async () => {
      const response = await call(route, { headers: { origin: "https://evil.example" } });
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a missing Origin and Sec-Fetch-Site: cross-site with 403", async () => {
      expect((await call(route, { headers: { origin: null } })).status).toBe(403);
      expect((await call(route, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses an oversize body with 413", async () => {
      const response = await call(route, { body: "x".repeat(route.bodyLimit + 1) });
      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  if (route.method !== "GET" && route.bodyLimit > 0) {
    it("refuses a non-JSON body with 415", async () => {
      const response = await call(route, { headers: { "content-type": "text/plain" }, body: "hello" });
      expect(response.status).toBe(415);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});

describe("unknown paths", () => {
  const fake = (method: AdminRoute["method"], path: string): AdminRoute => ({ method, browser: path, backend: "", bodyLimit: 0, timeoutMs: 1000 });

  it.each([
    ["GET", "nope"],
    ["GET", "bookings/lowercase1"],
    ["GET", "bookings/ABCDEFGHJK/extra"],
    ["POST", "staff/not-a-uuid/reset-password"],
    ["PATCH", "staff"],
    ["GET", "session"],
  ] as const)("%s /api/admin/%s is a 404 before any backend call", async (method, path) => {
    const response = await call(fake(method, path), { path });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 422 for a bad query value without calling the backend", async () => {
    const route = ADMIN_ROUTES.find((r) => r.browser === "insights")!;
    const response = await call(route, { path: "insights?range=5" });
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("answers from the backend", () => {
  const route = ADMIN_ROUTES.find((r) => r.browser === "overview")!;

  it("never returns a session token, even if the backend sends one", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ token: "cs_secret", viewer: { kind: "staff" } }));
    const body = await (await call(route)).json();
    expect(body).toEqual({ viewer: { kind: "staff" } });
    expect(JSON.stringify(body)).not.toContain("cs_secret");
  });

  it("passes 409, 422 and 429 through with Retry-After", async () => {
    for (const status of [409, 422, 429]) {
      fetchMock.mockResolvedValueOnce(okJson({ error: { code: "x", message: "m", requestId: "r" } }, { status, headers: { "content-type": "application/json", "retry-after": "30" } }));
      const response = await call(route);
      expect(response.status).toBe(status);
      expect(response.headers.get("retry-after")).toBe("30");
    }
  });

  it("clears the session cookie when the backend says 401", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ error: { code: "session_expired", message: "m", requestId: "r" } }, { status: 401 }));
    const response = await call(route);
    expect(response.status).toBe(401);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-cc_session=;/);
    expect(cookie).toMatch(/Max-Age=0/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\//);
  });

  it("does not set a cookie on other statuses", async () => {
    expect((await call(route)).headers.get("set-cookie")).toBeNull();
  });

  it("turns a backend 5xx into 502 upstream_error without echoing the body", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ detail: "SELECT secret FROM x" }, { status: 500 }));
    const response = await call(route);
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("SELECT");
  });

  it("turns a timeout into 504 and a network failure into 502", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect((await call(route)).status).toBe(504);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await call(route)).status).toBe(502);
  });

  it("is 503 when the backend address or secret is not configured", async () => {
    vi.stubEnv("CATALOG_API_URL", "");
    expect((await call(route)).status).toBe(503);
  });

  it("logs a path template on a backend 5xx, never a reference, a cookie or a body", async () => {
    const detail = ADMIN_ROUTES.find((r) => r.browser === "bookings/{ref}")!;
    fetchMock.mockResolvedValueOnce(okJson({ x: "private-body" }, { status: 500 }));
    await call(detail);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("/admin/bookings/{ref}");
    for (const secret of [REF, "cs_fake-session-token", "private-body", SECRET]) expect(logged).not.toContain(secret);
  });
});
