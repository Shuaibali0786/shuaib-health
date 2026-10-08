// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/(admin)/admin/demo/start/route";

// "View Demo Dashboard" (contracts/website-admin.md §3): a form POST that sets the session cookie and
// redirects. Refusals go back to the sign-in page with a calm message.

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const TOKEN = "cd_fake-demo-token-0123456789";
const OLD = "cs_fake-old-session-token";
const VIEWER = { kind: "demo", csrfToken: "csrf-abc", clinicToday: "2026-10-05", timezone: "Asia/Karachi" };

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

function formPost(headers: Record<string, string | null> = {}): Request {
  const base: Record<string, string> = { origin: SITE, "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "203.0.113.9" };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete base[name];
    else base[name] = value;
  }
  return new Request(`${SITE}/admin/demo/start`, { method: "POST", headers: base, body: "" });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  fetchMock = vi.fn(async () => json({ token: TOKEN, viewer: VIEWER }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /admin/demo/start", () => {
  it("sets the __Host- cookie and redirects 303 to /admin", async () => {
    const res = await POST(formPost());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toBe(`__Host-cc_session=${TOKEN}; Path=/; Secure; HttpOnly; SameSite=Strict`);
    expect(cookie).not.toMatch(/Domain|Max-Age/i);
  });

  it("asks the backend for a demo with the proxy secret and the visitor's address, and no body", async () => {
    await POST(formPost());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${ORIGIN}/api/v1/admin/demo/start`);
    expect(init.method).toBe("POST");
    expect(init.headers["x-proxy-secret"]).toBe(SECRET);
    expect(init.headers["x-client-ip"]).toBe("203.0.113.9");
    expect(init.body).toBeUndefined();
  });

  it("passes on a session the browser still holds so the backend ends it", async () => {
    await POST(formPost({ cookie: `__Host-cc_session=${OLD}` }));
    expect(fetchMock.mock.calls[0]![1].headers["x-session-token"]).toBe(OLD);
  });

  it("sends a busy visitor back to sign-in with ?demo=busy and sets no cookie", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "rate_limited", message: "x", requestId: "r" } }, { status: 429, headers: { "retry-after": "30", "content-type": "application/json" } }));
    const res = await POST(formPost());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/login?demo=busy");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sends the visitor back to sign-in when the backend is unreachable or answers something unexpected", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const down = await POST(formPost());
    expect(down.headers.get("location")).toBe("/admin/login?demo=unavailable");
    expect(down.headers.get("set-cookie")).toBeNull();

    fetchMock.mockResolvedValueOnce(json({ unexpected: true }));
    expect((await POST(formPost())).headers.get("location")).toBe("/admin/login?demo=unavailable");

    fetchMock.mockResolvedValueOnce(json({ token: TOKEN, viewer: { ...VIEWER, kind: "staff" } }));
    const wrongKind = await POST(formPost());
    expect(wrongKind.headers.get("location")).toBe("/admin/login?demo=unavailable");
    expect(wrongKind.headers.get("set-cookie")).toBeNull();

    fetchMock.mockResolvedValueOnce(json({ error: { code: "forbidden", message: "x", requestId: "r" } }, { status: 403 }));
    expect((await POST(formPost())).headers.get("location")).toBe("/admin/login?demo=unavailable");
  });

  it("refuses a cross-site POST before calling the backend", async () => {
    const refused: Record<string, string | null>[] = [{ origin: "http://evil.test" }, { origin: null }, { "sec-fetch-site": "cross-site" }];
    for (const headers of refused) {
      const res = await POST(formPost(headers));
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the null Origin of a form posted from a no-referrer page only when the browser says same-origin", async () => {
    const ok = await POST(formPost({ origin: "null", "sec-fetch-site": "same-origin" }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/admin");
    const refused: Record<string, string | null>[] = [{ origin: "null" }, { origin: "null", "sec-fetch-site": "cross-site" }];
    for (const headers of refused) {
      expect((await POST(formPost(headers))).status).toBe(403);
    }
  });

  it("never puts the token in the redirect target", async () => {
    const res = await POST(formPost());
    expect(res.headers.get("location")).not.toContain(TOKEN);
  });
});
