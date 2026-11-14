// @vitest-environment node
// Feature 013: the premium voice provider's token route (OFF unless VOICE_PROVIDER=azure).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/speech/token/route";

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";
const TOKEN = { token: "eyJ-fake-token-not-real-0123456789", region: "southeastasia", expiresInSeconds: 600 };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const request = (headers: Record<string, string> = { origin: SITE, "x-forwarded-for": "203.0.113.9" }) =>
  new Request(`${SITE}/api/speech/token`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  vi.stubEnv("ASSISTANT_ENABLED", "true");
  vi.stubEnv("VOICE_ENABLED", "true");
  vi.stubEnv("VOICE_PROVIDER", "azure");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/speech/token", () => {
  it("is 404 unless voice is on and the provider is azure", async () => {
    vi.stubEnv("VOICE_PROVIDER", "browser");
    expect((await POST(request())).status).toBe(404);
    vi.stubEnv("VOICE_PROVIDER", "azure");
    vi.stubEnv("VOICE_ENABLED", "false");
    expect((await POST(request())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses another site (CSRF guard)", async () => {
    expect((await POST(request({ origin: "https://evil.test" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the API with the proxy secret and passes only the token back, never cached", async () => {
    fetchMock.mockResolvedValue(json(TOKEN));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TOKEN);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/speech/token`);
    expect((init.headers as Record<string, string>)["x-proxy-secret"]).toBe(SECRET);
  });

  it("a rate limit stays 429; anything else is 503, so the browser voice takes over", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "rate_limited", message: "x", requestId: "r" } }, 429));
    expect((await POST(request())).status).toBe(429);
    fetchMock.mockResolvedValue(json({ error: { code: "not_found", message: "x", requestId: "r" } }, 404));
    expect((await POST(request())).status).toBe(503);
    fetchMock.mockResolvedValue(json({ token: "short" }));
    expect((await POST(request())).status).toBe(503);
  });
});
