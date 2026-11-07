// @vitest-environment node
// Feature 010 v1.1: the optional AI provider's website route (OFF by default).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/agent/knowledge", () => ({ loadKnowledgePack: async () => ({ clinic: { name: "Sample Clinic" }, doctors: [] }) }));

import { POST } from "@/app/api/assistant/route";

const ORIGIN = "http://api.test";
const SITE = "http://site.test";
const SECRET = "fake-unit-test-proxy-secret-0123456789";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function request(body: unknown, headers: Record<string, string | null> = {}): Request {
  const all: Record<string, string> = { origin: SITE, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete all[name];
    else all[name] = value;
  }
  return new Request(`${SITE}/api/assistant`, { method: "POST", headers: all, body: typeof body === "string" ? body : JSON.stringify(body) });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", ORIGIN);
  vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
  vi.stubEnv("ASSISTANT_ENABLED", "true");
  vi.stubEnv("ASSISTANT_PROVIDER", "claude");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/assistant", () => {
  it("is 404 unless the assistant is on and the provider is claude (the default)", async () => {
    vi.stubEnv("ASSISTANT_PROVIDER", "");
    expect((await POST(request({ question: "parking?" }))).status).toBe(404);
    vi.stubEnv("ASSISTANT_PROVIDER", "claude");
    vi.stubEnv("ASSISTANT_ENABLED", "");
    expect((await POST(request({ question: "parking?" }))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds the knowledge pack and the proxy secret on the server and returns only the text", async () => {
    fetchMock.mockResolvedValueOnce(json({ text: "Parking is next door.", provider: "claude" }));
    const res = await POST(request({ question: "parking?" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Parking is next door." });
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/api/v1/assistant/answer`);
    expect(JSON.parse(init.body as string)).toEqual({ question: "parking?", pack: { clinic: { name: "Sample Clinic" }, doctors: [] } });
    expect((init.headers as Record<string, string>)["x-proxy-secret"]).toBe(SECRET);
  });

  it("refuses cross-site requests, wrong types, bad bodies and extra fields before the backend", async () => {
    expect((await POST(request({ question: "x" }, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await POST(request({ question: "x" }, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request("{not json"))).status).toBe(422);
    expect((await POST(request({ question: "" }))).status).toBe(422);
    expect((await POST(request({ question: "x".repeat(301) }))).status).toBe(422);
    expect((await POST(request({ question: "x", pack: {} }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps every backend refusal to 429 or 503 so the browser falls back to the free engine", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: "service_unavailable" } }, 503));
    expect((await POST(request({ question: "parking?" }))).status).toBe(503);
    fetchMock.mockResolvedValueOnce(json({ error: { code: "rate_limited" } }, 429));
    expect((await POST(request({ question: "parking?" }))).status).toBe(429);
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    expect((await POST(request({ question: "parking?" }))).status).toBe(503);
  });
});
