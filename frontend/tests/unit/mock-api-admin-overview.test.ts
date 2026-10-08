// @vitest-environment node
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OverviewSchema, type Overview } from "@/admin/lib/schemas";
import { countStatuses, deriveOverview } from "@/admin/overview/model";
import { createMockServer } from "../mock-api/server.mjs";

// The mock API's /admin/overview follows the same definitions as the backend (data-model §8). The e2e
// specs rely on it, so it is held to the contract and to the fixture the backend generator produced.

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
const NOW = Date.parse(fixture.meta.now);

beforeEach(async () => {
  server = createMockServer({ proxySecret: SECRET } as never) as unknown as MockServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const overviewOf = async (token: string): Promise<Overview> => {
  const res = await fetch(`${base}/api/v1/admin/overview`, { headers: { "x-proxy-secret": SECRET, "x-session-token": token } });
  expect(res.status).toBe(200);
  return OverviewSchema.parse(await res.json());
};

describe("the fixture's overview", () => {
  it("is what the website accepts", () => {
    const parsed = OverviewSchema.parse(fixture.overview);
    expect(parsed.isSample).toBe(true);
    expect(parsed.localDate).toBe(fixture.meta.date);
    expect(parsed.agenda.length).toBeGreaterThanOrEqual(5);
    expect(parsed.agenda.every((r) => r.sessions.length > 0)).toBe(true);
  });

  it("adds up: the website derives the same numbers from the agenda as the server sent", () => {
    const parsed = OverviewSchema.parse(fixture.overview);
    const derived = deriveOverview(parsed, { nowMs: NOW });
    expect(derived.kpis).toEqual(parsed.kpis);
    expect(derived.nextUp.map((b) => b.reference)).toEqual(parsed.nextUp.map((b) => b.reference));
  });
});

describe("GET /admin/overview", () => {
  it("serves the demo the fixture's day", async () => {
    const demo = await overviewOf("cd_e2e-demo");
    expect(demo.isSample).toBe(true);
    expect(demo.recentBookings).toEqual([]);
    expect(demo.kpis.appointments).toEqual(fixture.overview.kpis.appointments);
    expect(demo.kpis.utilisationPct.value).toBe(fixture.overview.kpis.utilisationPct.value);
  });

  it("serves staff the same day with their own references, and a status change moves the numbers", async () => {
    const before = await overviewOf("cs_e2e-receptionist");
    const items = before.agenda.flatMap((r) => r.items);
    expect(items.every((b) => b.reference.startsWith("R") || b.reference.startsWith("T"))).toBe(true);
    const target = items.find((b) => b.allowedNext.includes("cancelled"))!;
    const res = await fetch(`${base}/api/v1/admin/bookings/${target.reference}/status`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-proxy-secret": SECRET, "x-session-token": "cs_e2e-receptionist", "x-csrf-token": "csrf-cs_e2e-receptionist" },
      body: JSON.stringify({ to: "cancelled", expectedVersion: target.version }),
    });
    expect(res.status).toBe(200);
    const after = await overviewOf("cs_e2e-receptionist");
    expect(after.kpis.cancellations.value).toBe((before.kpis.cancellations.value ?? 0) + 1);
    expect(after.kpis.appointments.value).toBe((before.kpis.appointments.value ?? 0) - 1);
    expect(countStatuses(after.agenda.flatMap((r) => r.items)).cancelled).toBe(after.kpis.cancellations.value);
  });

  it("lists the newest bookings of a staff session, newest first, once a booking is made", async () => {
    const res = await fetch(`${base}/__admin/new-booking`, { method: "POST", body: JSON.stringify({ name: "Mehwish Hanif", minutesFromNow: 20 }) });
    const { reference } = (await res.json()) as { reference: string };
    const staff = await overviewOf("cs_e2e-receptionist");
    expect(staff.recentBookings?.length).toBeLessThanOrEqual(5);
    expect(staff.recentBookings?.[0]).toMatchObject({ reference, patientNameMasked: "Mehwish H." });
    const stamps = staff.recentBookings!.map((b) => b.bookedAt);
    expect(stamps).toEqual([...stamps].sort().reverse());
  });

  it("gives the closed and empty test sessions a holiday and a day without bookings", async () => {
    const closed = await overviewOf("cs_e2e-closed");
    expect(closed.clinicClosed).toBe("Founders Day");
    expect(closed.agenda).toEqual([]);
    expect(closed.kpis.utilisationPct.value).toBeNull();
    const empty = await overviewOf("cs_e2e-empty");
    expect(empty.clinicClosed ?? null).toBeNull();
    expect(empty.agenda).toEqual([]);
    expect(empty.kpis.appointments.value).toBe(0);
  });

  it("refuses a visitor who is not signed in", async () => {
    const res = await fetch(`${base}/api/v1/admin/overview`, { headers: { "x-proxy-secret": SECRET } });
    expect(res.status).toBe(401);
  });
});
