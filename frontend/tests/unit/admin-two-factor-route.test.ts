// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as signIn } from "@/app/api/admin/session/route";
import { POST as verify } from "@/app/api/admin/session/two-factor/route";

// Feature 011: the challenge cookie of specs/011-admin-two-factor/contracts/two-factor-api.md (website routes).

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const CHALLENGE = "shc_fake-challenge-token-0123456789";
const TOKEN = "cs_fake-issued-token-0123456789";
const VIEWER = { kind: "staff", role: "admin", displayName: "Sample Admin", mustChangePassword: false, csrfToken: "csrf-abc", clinicToday: "2026-10-05", timezone: "Asia/Karachi" };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({ error: { code, message: "m", requestId: "r" }, ...extra });

function request(path: string, body: unknown, headers: Record<string, string | null> = {}): Request {
  const all: Record<string, string> = { origin: SITE, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete all[name];
    else all[name] = value;
  }
  return new Request(`${SITE}${path}`, { method: "POST", headers: all, body: typeof body === "string" ? body : JSON.stringify(body) });
}
const withChallenge = { cookie: `__Host-cc_2fa=${CHALLENGE}` };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sign-in answers 202 when a code is needed", () => {
  it("keeps the challenge in a __Host- httpOnly cookie for 5 minutes and tells the browser only that a code is needed", async () => {
    fetchMock.mockResolvedValueOnce(json({ twoFactorRequired: true, challengeToken: CHALLENGE, expiresAt: "2026-10-05T04:05:00Z" }, 202));
    const res = await signIn(request("/api/admin/session", { email: "a@clinic.test", password: "Typed-Password-1" }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ twoFactorRequired: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`__Host-cc_2fa=${CHALLENGE}`);
    for (const attribute of ["Max-Age=300", "Path=/", "Secure", "HttpOnly", "SameSite=Strict"]) expect(cookie).toContain(attribute);
    expect(cookie).not.toContain("cc_session");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("treats a malformed 202 as an upstream error", async () => {
    fetchMock.mockResolvedValueOnce(json({ twoFactorRequired: true }, 202));
    const res = await signIn(request("/api/admin/session", { email: "a@clinic.test", password: "Typed-Password-1" }));
    expect(res.status).toBe(502);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/admin/session/two-factor", () => {
  it("sends the cookie's challenge with the code, sets the session cookie, clears the challenge and returns only the viewer", async () => {
    fetchMock.mockResolvedValueOnce(json({ token: TOKEN, viewer: VIEWER }));
    const res = await verify(request("/api/admin/session/two-factor", { code: "123 456" }, withChallenge));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(VIEWER);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`__Host-cc_session=${TOKEN};`) && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("__Host-cc_2fa=;") && c.includes("Max-Age=0"))).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/admin/auth/sign-in/two-factor`);
    expect(JSON.parse(init.body as string)).toEqual({ challengeToken: CHALLENGE, code: "123 456" });
    expect((init.headers as Record<string, string>)["x-proxy-secret"]).toBe(SECRET);
  });

  it("passes a backup code through", async () => {
    fetchMock.mockResolvedValueOnce(json({ token: TOKEN, viewer: VIEWER }));
    await verify(request("/api/admin/session/two-factor", { backupCode: "ABCDE-FGHJK" }, withChallenge));
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({ challengeToken: CHALLENGE, backupCode: "ABCDE-FGHJK" });
  });

  it("answers challenge_expired without calling the backend when there is no challenge cookie", async () => {
    const res = await verify(request("/api/admin/session/two-factor", { code: "123456" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("challenge_expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request, a bad body or both factors at once before the backend", async () => {
    expect((await verify(request("/api/admin/session/two-factor", { code: "123456" }, { ...withChallenge, origin: "https://evil.test" }))).status).toBe(403);
    expect((await verify(request("/api/admin/session/two-factor", { code: "12345a" }, withChallenge))).status).toBe(422);
    expect((await verify(request("/api/admin/session/two-factor", { code: "123456", backupCode: "ABCDE-FGHJK" }, withChallenge))).status).toBe(422);
    expect((await verify(request("/api/admin/session/two-factor", { code: "123456", challengeToken: "x" }, withChallenge))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the challenge after a wrong code but clears it when the step has ended", async () => {
    fetchMock.mockResolvedValueOnce(json(errorBody("two_factor_failed", { attemptsLeft: 3 }), 401));
    const wrong = await verify(request("/api/admin/session/two-factor", { code: "000000" }, withChallenge));
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).attemptsLeft).toBe(3);
    expect(wrong.headers.get("set-cookie")).toBeNull();

    fetchMock.mockResolvedValueOnce(json(errorBody("challenge_expired"), 401));
    const ended = await verify(request("/api/admin/session/two-factor", { code: "000000" }, withChallenge));
    expect(ended.headers.get("set-cookie")).toContain("__Host-cc_2fa=;");

    fetchMock.mockResolvedValueOnce(json(errorBody("account_locked"), 429, { "retry-after": "900" }));
    const locked = await verify(request("/api/admin/session/two-factor", { code: "000000" }, withChallenge));
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBe("900");
    expect(locked.headers.get("set-cookie")).toContain("__Host-cc_2fa=;");
  });
});
