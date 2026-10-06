// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMockServer } from "../mock-api/server.mjs";
import { ViewerSchema } from "@/admin/lib/schemas";

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

const me = (token?: string, secret: string | null = SECRET) =>
  fetch(`${base}/api/v1/admin/auth/me`, {
    headers: { ...(secret ? { "x-proxy-secret": secret } : {}), ...(token ? { "x-session-token": token } : {}) },
  });

const setMode = (mode: string) => fetch(`${base}/__mode`, { method: "POST", body: JSON.stringify({ mode }) });

describe("mock admin API: me", () => {
  it.each([
    ["cs_e2e-admin", "staff", "admin"],
    ["cs_e2e-receptionist", "staff", "receptionist"],
    ["cd_e2e-demo", "demo", undefined],
  ])("%s is a contract-valid %s viewer", async (token, kind, role) => {
    const res = await me(token);
    expect(res.status).toBe(200);
    const viewer = ViewerSchema.parse(await res.json());
    expect(viewer.kind).toBe(kind);
    expect(viewer.role).toBe(role);
    expect(viewer.clinicToday).toBe("2026-10-05");
    expect(viewer.csrfToken).toBeTruthy();
  });

  it("flags a staff member who must change their password", async () => {
    expect(ViewerSchema.parse(await (await me("cs_e2e-must-change")).json()).mustChangePassword).toBe(true);
  });

  it("is 401 not_signed_in without a session or with an unknown one", async () => {
    for (const token of [undefined, "cs_unknown"]) {
      const res = await me(token);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("not_signed_in");
    }
  });

  it("is 403 without the proxy secret", async () => {
    expect((await me("cs_e2e-admin", null)).status).toBe(403);
    expect((await me("cs_e2e-admin", "wrong")).status).toBe(403);
  });

  it("is 404 for admin paths it does not serve yet", async () => {
    const res = await fetch(`${base}/api/v1/admin/insights`, { headers: { "x-proxy-secret": SECRET, "x-session-token": "cs_e2e-admin" } });
    expect(res.status).toBe(404);
  });
});

describe("mock admin API: modes", () => {
  it("session-expired answers 401 session_expired", async () => {
    await setMode("session-expired");
    const res = await me("cs_e2e-admin");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("session_expired");
  });

  it("admin-down drops the connection", async () => {
    await setMode("admin-down");
    await expect(me("cs_e2e-admin")).rejects.toThrow();
  });

  it("leaves the catalog and booking routes alone", async () => {
    for (const mode of ["admin-down", "admin-slow", "session-expired", "booking-changed"]) {
      await setMode(mode);
      const res = await fetch(`${base}/api/v1/clinic`);
      expect(res.status, mode).toBe(200);
    }
  });

  it("rejects an unknown mode", async () => {
    expect((await setMode("no-such-mode")).status).toBe(400);
  });
});
