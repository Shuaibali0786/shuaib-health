// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getJson } from "@/lib/api/http";

const Item = z.object({ name: z.string() });
const SECRET = "s".repeat(32);

function mockFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "ok" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return init.headers as Record<string, string>;
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", "http://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("catalog fetch proxy secret", () => {
  it("sends x-proxy-secret, and no x-client-ip without a visitor", async () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
    const fetchMock = mockFetch();
    await getJson("/clinic", Item);
    const headers = sentHeaders(fetchMock);
    expect(headers["x-proxy-secret"]).toBe(SECRET);
    expect(headers["x-client-ip"]).toBeUndefined();
  });

  it("adds x-client-ip when the caller has a visitor", async () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", SECRET);
    const fetchMock = mockFetch();
    await getJson("/clinic", Item, undefined, "203.0.113.9");
    expect(sentHeaders(fetchMock)["x-client-ip"]).toBe("203.0.113.9");
  });

  it("sends neither header when the secret is missing or too short", async () => {
    vi.stubEnv("BOOKING_PROXY_SECRET", "short");
    const fetchMock = mockFetch();
    await getJson("/clinic", Item, undefined, "203.0.113.9");
    const headers = sentHeaders(fetchMock);
    expect(headers["x-proxy-secret"]).toBeUndefined();
    expect(headers["x-client-ip"]).toBeUndefined();
  });

  it("is a server-only module, so the secret cannot reach a client bundle", () => {
    const source = readFileSync(resolve(__dirname, "../../src/lib/api/http.ts"), "utf8");
    expect(source.split(/\r?\n/)[0]).toBe('import "server-only";');
  });
});
