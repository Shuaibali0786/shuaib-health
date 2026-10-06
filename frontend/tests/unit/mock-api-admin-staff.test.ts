// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ViewerSchema } from "@/admin/lib/schemas";
import { createMockServer } from "../mock-api/server.mjs";

interface MockServer {
  listen(port: number, host: string, cb: () => void): void;
  close(cb?: () => void): void;
  closeAllConnections(): void;
  address(): AddressInfo;
}

const SECRET = "fake-mock-proxy-secret-0123456789abcdef";
const PASSWORD = "Correct-Horse-9-Battery";
const NEW_PASSWORD = "Another-Fine-Passphrase-7";
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

const call = (method: string, path: string, { token, body, csrf = true }: { token?: string; body?: unknown; csrf?: boolean } = {}) =>
  fetch(`${base}/api/v1/admin${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-proxy-secret": SECRET,
      ...(token ? { "x-session-token": token } : {}),
      ...(token && csrf ? { "x-csrf-token": `csrf-${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const signIn = (email: string, password = PASSWORD) => call("POST", "/auth/sign-in", { body: { email, password } });
const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("mock admin API: sign-in", () => {
  it("signs a test account in with a contract-valid viewer and a token", async () => {
    const res = await signIn("admin@clinic.test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("cs_e2e-admin");
    expect(ViewerSchema.parse(body.viewer).role).toBe("admin");
  });

  it("answers a wrong password and an unknown email the same way", async () => {
    for (const res of [await signIn("admin@clinic.test", "nope"), await signIn("ghost@clinic.test")]) {
      expect(res.status).toBe(401);
      expect(await codeOf(res)).toBe("sign_in_failed");
    }
  });

  it("locks locked@clinic.test with Retry-After", async () => {
    const res = await signIn("locked@clinic.test");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect((await res.json()).error.retryAfterSeconds).toBe(900);
  });

  it("changes a password and issues a fresh session without the must-change flag", async () => {
    const res = await call("POST", "/auth/change-password", { token: "cs_e2e-must-change", body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).not.toBe("cs_e2e-must-change");
    expect(body.viewer.mustChangePassword).toBe(false);
    expect((await signIn("must-change@clinic.test", NEW_PASSWORD)).status).toBe(200);
  });

  it("refuses a weak password and a wrong current password", async () => {
    const weak = await call("POST", "/auth/change-password", { token: "cs_e2e-admin", body: { currentPassword: PASSWORD, newPassword: "password1234" } });
    expect(weak.status).toBe(422);
    expect(await weak.json()).toMatchObject({ error: { code: "weak_password" }, reason: "too_common" });
    const wrong = await call("POST", "/auth/change-password", { token: "cs_e2e-admin", body: { currentPassword: "nope", newPassword: NEW_PASSWORD } });
    expect((await wrong.json()).error.details[0].field).toBe("currentPassword");
  });

  it("answers sign-out with 204 and /__reset restores the seed accounts", async () => {
    expect((await call("POST", "/auth/sign-out", { token: "cs_e2e-admin" })).status).toBe(204);
    await call("PATCH", "/staff/22222222-2222-4222-8222-222222222222", { token: "cs_e2e-admin", body: { isActive: false } });
    expect((await signIn("receptionist@clinic.test")).status).toBe(401);
    await fetch(`${base}/__reset`, { method: "POST" });
    expect((await signIn("receptionist@clinic.test")).status).toBe(200);
  });
});

describe("mock admin API: staff", () => {
  it("lists staff for an admin only", async () => {
    expect((await call("GET", "/staff", { token: "cs_e2e-admin" })).status).toBe(200);
    expect(await codeOf(await call("GET", "/staff", { token: "cs_e2e-receptionist" }))).toBe("forbidden");
    expect(await codeOf(await call("GET", "/staff", { token: "cs_e2e-must-change" }))).toBe("password_change_required");
    expect(await (await call("GET", "/staff", { token: "cd_e2e-demo" })).json()).toEqual([]);
  });

  it("creates, resets, deactivates and keeps the last admin", async () => {
    const created = await call("POST", "/staff", {
      token: "cs_e2e-admin",
      body: { email: "New.Person@Clinic.test", displayName: "New Person", role: "receptionist", temporaryPassword: "abcd-efgh-jkmn-pqrs" },
    });
    expect(created.status).toBe(201);
    const member = await created.json();
    expect(member).toMatchObject({ email: "new.person@clinic.test", mustChangePassword: true, isActive: true });
    expect(member).not.toHaveProperty("password");

    const duplicate = await call("POST", "/staff", {
      token: "cs_e2e-admin",
      body: { email: "NEW.PERSON@clinic.test", displayName: "X", role: "admin", temporaryPassword: "abcd-efgh-jkmn-pqrs" },
    });
    expect(await codeOf(duplicate)).toBe("email_taken");

    const reset = await call("POST", `/staff/${member.id}/reset-password`, { token: "cs_e2e-admin", body: { temporaryPassword: "wxyz-2345-6789-abcd" } });
    expect(reset.status).toBe(204);
    const off = await call("PATCH", `/staff/${member.id}`, { token: "cs_e2e-admin", body: { isActive: false } });
    expect((await off.json()).isActive).toBe(false);

    const last = await call("PATCH", "/staff/11111111-1111-4111-8111-111111111111", { token: "cs_e2e-admin", body: { role: "receptionist" } });
    expect(last.status).toBe(409);
    expect(await codeOf(last)).toBe("last_admin");
  });

  it("requires the CSRF token on writes, and a demo viewer cannot write", async () => {
    expect(await codeOf(await call("POST", "/staff", { token: "cs_e2e-admin", csrf: false, body: {} }))).toBe("csrf_failed");
    expect(await codeOf(await call("POST", "/staff", { token: "cd_e2e-demo", body: {} }))).toBe("demo_read_only");
  });
});
