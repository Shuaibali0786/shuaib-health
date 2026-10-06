// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ViewerSchema } from "@/admin/lib/schemas";
import { createMockServer } from "../mock-api/server.mjs";

// The mock API's demo entry (specs/006-clinic-command-centre/contracts/website-admin.md §6).

interface MockServer {
  listen(port: number, host: string, cb: () => void): void;
  close(cb?: () => void): void;
  closeAllConnections(): void;
  address(): AddressInfo;
}

const SECRET = "fake-mock-proxy-secret-0123456789abcdef";
let server: MockServer;
let base: string;

beforeEach(async () => {
  server = createMockServer({ proxySecret: SECRET } as never) as unknown as MockServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const call = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
  fetch(`${base}/api/v1/admin${path}`, {
    method,
    headers: { "content-type": "application/json", "x-proxy-secret": SECRET, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("mock admin API: demo", () => {
  it("starts a demo session whose viewer is a demo viewer for the fixture date", async () => {
    const res = await call("POST", "/demo/start");
    expect(res.status).toBe(200);
    const { token, viewer } = await res.json();
    expect(token).toMatch(/^cd_/);
    expect(ViewerSchema.parse(viewer)).toMatchObject({ kind: "demo", clinicToday: "2026-10-05", timezone: "Asia/Karachi" });
    expect(viewer.role).toBeUndefined();
    const me = await call("GET", "/auth/me", { "x-session-token": token });
    expect((await me.json()).kind).toBe("demo");
  });

  it("refuses writes from a demo session and ends nothing on a read", async () => {
    const { token } = await (await call("POST", "/demo/start")).json();
    const write = await call("POST", "/staff", { "x-session-token": token }, { email: "a@b.test" });
    expect(write.status).toBe(403);
    expect((await write.json()).error.code).toBe("demo_read_only");
    expect((await call("GET", "/staff", { "x-session-token": token })).status).toBe(200);
  });

  it("answers an expired demo token with session_expired", async () => {
    const res = await call("GET", "/auth/me", { "x-session-token": "cd_e2e-demo-expired" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("session_expired");
  });

  it("tells one test address that the demo is busy", async () => {
    const res = await call("POST", "/demo/start", { "x-client-ip": "198.51.100.99" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await call("POST", "/demo/start", { "x-client-ip": "203.0.113.1" })).status).toBe(200);
  });

  it("needs the proxy secret", async () => {
    const res = await fetch(`${base}/api/v1/admin/demo/start`, { method: "POST" });
    expect(res.status).toBe(403);
  });
});
