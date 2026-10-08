// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as changePassword } from "@/app/api/admin/password/route";
import { DELETE as signOut, POST as signIn } from "@/app/api/admin/session/route";

// The session cookie contract of specs/006-clinic-command-centre/contracts/website-admin.md §2 and §3.

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const TOKEN = "cs_fake-issued-token-0123456789";
const OLD = "cs_fake-old-session-token";
const VIEWER = { kind: "staff", role: "admin", displayName: "Sample Admin", mustChangePassword: false, csrfToken: "csrf-abc", clinicToday: "2026-10-05", timezone: "Asia/Karachi" };
const SECRET_PASSWORD = "Fake-Typed-Password-77";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const issued = () => json({ token: TOKEN, viewer: VIEWER });

function request(path: string, init: { method: string; body?: unknown; headers?: Record<string, string | null> }): Request {
  const headers: Record<string, string> = { origin: SITE, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" };
  for (const [name, value] of Object.entries(init.headers ?? {})) {
    if (value === null) delete headers[name];
    else headers[name] = value;
  }
  const body = init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  return new Request(`${SITE}${path}`, { method: init.method, headers, body });
}

const signInRequest = (over: { body?: unknown; headers?: Record<string, string | null> } = {}) =>
  request("/api/admin/session", { method: "POST", body: over.body ?? { email: "a@clinic.test", password: SECRET_PASSWORD }, headers: over.headers });
const passwordRequest = (over: { body?: unknown; headers?: Record<string, string | null> } = {}) =>
  request("/api/admin/password", {
    method: "POST",
    body: over.body ?? { currentPassword: SECRET_PASSWORD, newPassword: "Another-Fine-Passphrase-7" },
    headers: { cookie: `__Host-cc_session=${OLD}`, "x-csrf-token": "csrf-old", ...over.headers },
  });

let fetchMock: ReturnType<typeof vi.fn>;
let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  fetchMock = vi.fn(async () => issued());
  vi.stubGlobal("fetch", fetchMock);
  logs = (["log", "info", "warn", "error"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sign-in (POST /api/admin/session)", () => {
  it("sets the __Host- cookie with every required attribute and returns only the viewer", async () => {
    const res = await signIn(signInRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VIEWER);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie.startsWith(`__Host-cc_session=${TOKEN};`)).toBe(true);
    for (const attribute of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) expect(cookie).toContain(attribute);
    expect(cookie).not.toMatch(/Domain=|Max-Age=|Expires=/i);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(JSON.stringify(await signIn(signInRequest()).then((r) => r.text()))).not.toContain(TOKEN);
  });

  it("calls the backend with the proxy secret, the client address and the typed credentials only", async () => {
    await signIn(signInRequest());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/admin/auth/sign-in`);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-proxy-secret"]).toBe(SECRET);
    expect(headers["x-client-ip"]).toBe("203.0.113.9");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@clinic.test", password: SECRET_PASSWORD });
    expect(headers["x-session-token"]).toBeUndefined();
  });

  it("passes the browser's old token on, so the backend ends it (no session fixation)", async () => {
    await signIn(signInRequest({ headers: { cookie: `__Host-cc_session=${OLD}` } }));
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers["x-session-token"]).toBe(OLD);
  });

  it("passes a failed sign-in through without touching the cookie", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "sign_in_failed", message: "Email or password is incorrect.", requestId: "r" } }, { status: 401 }));
    const res = await signIn(signInRequest({ headers: { cookie: `__Host-cc_session=${OLD}` } }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("sign_in_failed");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes a lockout through with Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "account_locked", message: "Too many attempts.", requestId: "r", retryAfterSeconds: 900 } }, { status: 429, headers: { "content-type": "application/json", "retry-after": "900" } }),
    );
    const res = await signIn(signInRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
  });

  it.each([
    ["cross-site Origin", { origin: "http://evil.test" }, 403],
    ["Sec-Fetch-Site: cross-site", { "sec-fetch-site": "cross-site" }, 403],
    ["no Origin", { origin: null }, 403],
    ["non-JSON content type", { "content-type": "text/plain" }, 415],
  ])("refuses %s before any backend call", async (_name, headers, status) => {
    const res = await signIn(signInRequest({ headers }));
    expect(res.status).toBe(status);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses an oversize or malformed body, and unexpected fields", async () => {
    expect((await signIn(signInRequest({ body: { email: "a@b.test", password: "x".repeat(3000) } }))).status).toBe(413);
    expect((await signIn(signInRequest({ body: "{not json" }))).status).toBe(422);
    expect((await signIn(signInRequest({ body: { email: "a@b.test", password: "x", admin: true } }))).status).toBe(422);
    expect((await signIn(signInRequest({ body: { email: 1, password: "x" } }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a backend 5xx or an unexpected body to 502, a timeout to 504, and never sets a cookie", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "internal_error", message: "x", requestId: "r" } }, { status: 500 }));
    const server = await signIn(signInRequest());
    expect(server.status).toBe(502);
    fetchMock.mockResolvedValueOnce(json({ token: "", viewer: {} }));
    expect((await signIn(signInRequest())).status).toBe(502);
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const slow = await signIn(signInRequest());
    expect(slow.status).toBe(504);
    expect(slow.headers.get("set-cookie")).toBeNull();
  });

  it("never logs the password or a token", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "internal_error", message: "x", requestId: "r" } }, { status: 500 }));
    await signIn(signInRequest());
    await signIn(signInRequest());
    const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(SECRET_PASSWORD);
    expect(logged).not.toContain(TOKEN);
  });
});

describe("sign-out (DELETE /api/admin/session)", () => {
  const out = (headers: Record<string, string | null> = {}) =>
    signOut(request("/api/admin/session", { method: "DELETE", headers: { cookie: `__Host-cc_session=${OLD}`, "x-csrf-token": "csrf-old", ...headers } }));
  const cleared = (res: Response) => {
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-cc_session=;");
    expect(cookie).toContain("Max-Age=0");
    for (const attribute of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) expect(cookie).toContain(attribute);
  };

  it("ends the session on the server and clears the cookie", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await out();
    expect(res.status).toBe(204);
    cleared(res);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/admin/auth/sign-out`);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-session-token"]).toBe(OLD);
    expect(headers["x-csrf-token"]).toBe("csrf-old");
  });

  it.each([
    ["a backend error", () => fetchMock.mockResolvedValueOnce(json({ error: { code: "internal_error", message: "x", requestId: "r" } }, { status: 500 }))],
    ["a 401", () => fetchMock.mockResolvedValueOnce(json({ error: { code: "not_signed_in", message: "x", requestId: "r" } }, { status: 401 }))],
    ["an unreachable backend", () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))],
    ["a timeout", () => fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }))],
  ])("still clears the cookie after %s", async (_name, arrange) => {
    arrange();
    const res = await out();
    expect(res.status).toBe(204);
    cleared(res);
  });

  it("clears the cookie without a backend call when there is none", async () => {
    const res = await out({ cookie: null });
    expect(res.status).toBe(204);
    cleared(res);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request and leaves the session alone", async () => {
    const res = await out({ origin: "http://evil.test" });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("change password (POST /api/admin/password)", () => {
  it("replaces the cookie with the new session's token and returns only the viewer", async () => {
    const res = await changePassword(passwordRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VIEWER);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie.startsWith(`__Host-cc_session=${TOKEN};`)).toBe(true);
    for (const attribute of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) expect(cookie).toContain(attribute);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/admin/auth/change-password`);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-session-token"]).toBe(OLD);
    expect(headers["x-csrf-token"]).toBe("csrf-old");
  });

  it("needs the session cookie and a same-site request", async () => {
    expect((await changePassword(passwordRequest({ headers: { cookie: null } }))).status).toBe(401);
    expect((await changePassword(passwordRequest({ headers: { origin: "http://evil.test" } }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a short new password and unexpected fields without calling the backend", async () => {
    expect((await changePassword(passwordRequest({ body: { currentPassword: "x", newPassword: "short" } }))).status).toBe(422);
    expect((await changePassword(passwordRequest({ body: { currentPassword: "x", newPassword: "Long-Enough-Password-1", extra: 1 } }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a weak-password refusal through, reason included, and keeps the cookie", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "weak_password", message: "x", requestId: "r" }, reason: "too_common" }, { status: 422 }));
    const res = await changePassword(passwordRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe("too_common");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("clears the cookie when the backend says the session is over", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "session_expired", message: "x", requestId: "r" } }, { status: 401 }));
    const res = await changePassword(passwordRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });
});
