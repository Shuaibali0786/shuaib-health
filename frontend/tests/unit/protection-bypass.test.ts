// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { protectionBypassHeaders } from "@/lib/api/config";
import { getJson } from "@/lib/api/http";
import { callBooking } from "@/lib/booking/backend";

const BYPASS = "bypass-token-for-tests-only";
const Item = z.object({ name: z.string() });

function mockFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "ok" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return init.headers as Record<string, string>;
}

beforeEach(() => {
  vi.stubEnv("CATALOG_API_URL", "http://api.test");
  vi.stubEnv("BOOKING_PROXY_SECRET", "s".repeat(32));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API_PROTECTION_BYPASS (Preview only)", () => {
  it("is added to catalog and booking calls when set", async () => {
    vi.stubEnv("API_PROTECTION_BYPASS", BYPASS);
    vi.stubEnv("VERCEL_ENV", "preview");
    const catalog = mockFetch();
    await getJson("/clinic", Item);
    expect(sent(catalog)["x-vercel-protection-bypass"]).toBe(BYPASS);

    vi.unstubAllGlobals();
    const booking = mockFetch();
    await callBooking({ method: "GET", path: "/appointments/x", clientIp: "203.0.113.9", requestId: "r1", timeoutMs: 1000 });
    expect(sent(booking)["x-vercel-protection-bypass"]).toBe(BYPASS);
  });

  it("is absent when unset", async () => {
    vi.stubEnv("API_PROTECTION_BYPASS", "");
    const catalog = mockFetch();
    await getJson("/clinic", Item);
    expect(sent(catalog)["x-vercel-protection-bypass"]).toBeUndefined();
    expect(protectionBypassHeaders()).toEqual({});
  });

  it("is never sent in Production, even if the variable is set there by mistake", () => {
    vi.stubEnv("API_PROTECTION_BYPASS", BYPASS);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(protectionBypassHeaders()).toEqual({});
  });

  it.each(["src/lib/api/config.ts", "src/lib/api/http.ts", "src/lib/booking/backend.ts", "src/admin/lib/server.ts"])(
    "%s is server-only, so the token cannot reach a client bundle",
    (file) => {
      const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
      expect(source.split(/\r?\n/)[0]).toBe('import "server-only";');
    },
  );

  it("the token is never written to a log call", () => {
    for (const file of ["src/lib/api/config.ts", "src/lib/api/http.ts", "src/lib/booking/backend.ts", "src/admin/lib/server.ts"]) {
      const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
      expect(source, file).not.toMatch(/console\.\w+\([^)]*(protection|bypass)/i);
    }
  });
});
