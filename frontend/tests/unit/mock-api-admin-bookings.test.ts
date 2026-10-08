// @vitest-environment node
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BookingDetailSchema, BookingPageSchema, LookupsSchema, StatusChangeResultSchema, type BookingStatus } from "@/admin/lib/schemas";
import { allowedNext as clientRules } from "@/admin/lib/statusRules";
import { allowedNext as mockRules } from "../mock-api/admin-bookings.mjs";
import { createMockServer } from "../mock-api/server.mjs";

interface MockServer {
  listen(port: number, host: string, cb: () => void): void;
  close(cb?: () => void): void;
  closeAllConnections(): void;
  address(): AddressInfo;
}
const SECRET = "fake-mock-proxy-secret-0123456789abcdef";
let server: MockServer;
let base: string;
const fixture = JSON.parse(readFileSync(new URL("../fixtures/admin/demo-day.json", import.meta.url), "utf8"));

beforeEach(async () => {
  server = createMockServer({ proxySecret: SECRET } as never) as unknown as MockServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const STAFF = "cs_e2e-receptionist";
const call = (method: string, path: string, { token = STAFF, body, csrf = true }: { token?: string; body?: unknown; csrf?: boolean } = {}) =>
  fetch(`${base}/api/v1/admin${path}`, {
    method,
    headers: { "content-type": "application/json", "x-proxy-secret": SECRET, "x-session-token": token, ...(csrf ? { "x-csrf-token": `csrf-${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const search = async (body: unknown, token = STAFF) => BookingPageSchema.parse(await (await call("POST", "/bookings/search", { body, token })).json());
const codeOf = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("mock admin API: bookings", () => {
  it("serves the lookups and a first page of twenty with the status counts", async () => {
    expect(LookupsSchema.parse(await (await call("GET", "/lookups")).json()).doctors.length).toBeGreaterThan(3);
    const page = await search({});
    expect(page.items).toHaveLength(20);
    expect(page.total).toBe(fixture.details.length);
    expect(Object.values(page.statusCounts ?? {}).reduce((a, b) => a + b, 0)).toBe(page.total);
  });

  it("finds by partial reference and by name, case-insensitively, and filters by status and doctor", async () => {
    const sample = fixture.details[5];
    expect((await search({ q: sample.reference.slice(3, 8).toLowerCase() })).items.map((b) => b.reference)).toContain(`R${sample.reference.slice(1)}`);
    expect((await search({ q: sample.patientName.split(" ")[0].toUpperCase() })).total).toBeGreaterThan(0);
    const confirmed = await search({ statuses: ["confirmed"] });
    expect(confirmed.items.every((b) => b.status === "confirmed")).toBe(true);
    const byDoctor = await search({ doctorId: sample.doctor.id });
    expect(byDoctor.items.every((b) => b.doctor.id === sample.doctor.id)).toBe(true);
  });

  it("refuses a search text over 80 characters with 422", async () => {
    expect((await call("POST", "/bookings/search", { body: { q: "x".repeat(81) } })).status).toBe(422);
  });

  it("changes a status with a version check, a history entry, and an undo", async () => {
    const target = (await search({ statuses: ["confirmed"] })).items.find((b) => b.allowedNext.includes("arrived"))!;
    const changed = StatusChangeResultSchema.parse(await (await call("POST", `/bookings/${target.reference}/status`, { body: { to: "arrived", expectedVersion: target.version } })).json());
    expect(changed.booking.status).toBe("arrived");
    expect(changed.booking.version).toBe(target.version + 1);
    expect(changed.booking.history.at(-1)).toMatchObject({ fromStatus: "confirmed", toStatus: "arrived", isUndo: false });

    const stale = await call("POST", `/bookings/${target.reference}/status`, { body: { to: "completed", expectedVersion: target.version } });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { error: { code: string }; latest: unknown };
    expect(body.error.code).toBe("booking_changed");
    expect(BookingDetailSchema.parse(body.latest).status).toBe("arrived");

    const undone = BookingDetailSchema.parse(await (await call("POST", `/bookings/${target.reference}/status/undo`, { body: { changeId: changed.changeId } })).json());
    expect(undone.status).toBe("confirmed");
    expect(undone.history.at(-1)?.isUndo).toBe(true);
    expect(await codeOf(await call("POST", `/bookings/${target.reference}/status/undo`, { body: { changeId: changed.changeId } }))).toBe("undo_unavailable");
  });

  it("refuses a change the rules do not allow", async () => {
    const done = (await search({ statuses: ["completed"] })).items[0]!;
    expect(await codeOf(await call("POST", `/bookings/${done.reference}/status`, { body: { to: "arrived", expectedVersion: done.version } }))).toBe("transition_not_allowed");
  });

  it("needs a CSRF token for a staff write and refuses every demo write", async () => {
    const target = (await search({ statuses: ["confirmed"] })).items[0]!;
    expect(await codeOf(await call("POST", `/bookings/${target.reference}/status`, { body: { to: "cancelled", expectedVersion: 1 }, csrf: false }))).toBe("csrf_failed");
    const demo = await call("POST", `/bookings/${fixture.details[0].reference}/status`, { token: "cd_e2e-demo", body: { to: "arrived", expectedVersion: 1 } });
    expect(demo.status).toBe(403);
    expect(await codeOf(demo)).toBe("demo_read_only");
  });

  it("lets the demo search and reveal a sample phone, and gives nobody a phone without asking", async () => {
    const page = await search({}, "cd_e2e-demo");
    expect(page.items[0]!.reference.startsWith("D")).toBe(true);
    const ref = page.items[0]!.reference;
    expect(JSON.stringify(page)).not.toMatch(/\d{4} \d{7}/);
    const reveal = (await (await call("POST", `/bookings/${ref}/reveal-phone`, { token: "cd_e2e-demo" })).json()) as { phone: string; telHref: string };
    expect(reveal.phone).toMatch(/^\d{4} \d{7}$/);
    expect(reveal.telHref).toMatch(/^tel:\+923\d{9}$/);
  });

  it("answers 404 for an unknown reference", async () => {
    expect((await call("GET", "/bookings/ZZZZZZZZZZ")).status).toBe(404);
  });

  it("applies the same status rules as the website's copy over a grid of times", () => {
    const start = Date.parse("2026-10-05T06:40:00Z");
    const statuses: BookingStatus[] = ["confirmed", "arrived", "completed", "no_show", "cancelled"];
    for (const status of statuses) {
      for (let minutes = -240; minutes <= 240; minutes += 5) {
        const now = start + minutes * 60_000;
        expect(mockRules(status, start, now), `${status} at ${minutes}`).toEqual(clientRules(status, start, now));
      }
    }
  });
});
