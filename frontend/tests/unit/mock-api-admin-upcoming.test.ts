// @vitest-environment node
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BookingPageSchema, NewBookingsSchema, OverviewSchema } from "@/admin/lib/schemas";
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
const call = (method: string, path: string, { token = STAFF, body }: { token?: string; body?: unknown } = {}) =>
  fetch(`${base}/api/v1/admin${path}`, {
    method,
    headers: { "content-type": "application/json", "x-proxy-secret": SECRET, "x-session-token": token, "x-csrf-token": `csrf-${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const search = async (body: unknown, token = STAFF) => BookingPageSchema.parse(await (await call("POST", "/bookings/search", { body, token })).json());
const bell = async (token = STAFF) => NewBookingsSchema.parse(await (await call("GET", "/bookings/new", { token })).json());
const TODAY: string = fixture.meta.date;

describe("mock admin API: upcoming, recently booked, New (Feature 012)", () => {
  it("Upcoming lists only days after today, soonest first, with a count for every day", async () => {
    const page = await search({ scope: "upcoming" });
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((b) => b.localDate > TODAY)).toBe(true);
    const starts = page.items.map((b) => b.startsAt);
    expect(starts).toEqual([...starts].sort());
    const days = page.dayCounts ?? [];
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(page.total);
  });

  it("a typed search looks at every date, whatever date is selected", async () => {
    const future = (await search({ scope: "upcoming" })).items[0]!;
    const dated = await search({ q: future.reference.slice(2, 8), from: TODAY, to: TODAY });
    expect(dated.items.map((b) => b.reference)).toContain(future.reference);
    expect((await search({ from: TODAY, to: TODAY, doctorId: future.doctor.id })).items.some((b) => b.reference === future.reference)).toBe(false);
  });

  it("Recently booked keeps what was made in the window, newest first when asked, and refuses other windows", async () => {
    const day = await search({ bookedWithinHours: 24, sort: "recently_booked" });
    expect(day.total).toBeGreaterThan(0);
    const booked = day.items.map((b) => Date.parse(b.bookedAt));
    expect(booked).toEqual([...booked].sort((a, b) => b - a));
    const week = await search({ bookedWithinHours: 168 });
    expect(week.total).toBeGreaterThanOrEqual(day.total);
    expect((await call("POST", "/bookings/search", { body: { bookedWithinHours: 48 } })).status).toBe(422);
  });

  it("the bell lists the newest first and Mark all seen / opening clear it for this staff member only", async () => {
    const first = await bell();
    expect(first.count).toBeGreaterThan(1);
    expect(first.items.length).toBeLessThanOrEqual(5);
    expect(first.items.every((b) => b.isNew)).toBe(true);
    const listed = (await search({ scope: "upcoming" })).items.filter((b) => b.isNew);
    expect(listed.length).toBeGreaterThan(0);

    const opened = first.items[0]!.reference;
    const afterOpen = NewBookingsSchema.parse(await (await call("POST", "/bookings/seen", { body: { references: [opened] } })).json());
    expect(afterOpen.count).toBe(first.count - 1);
    expect((await bell("cs_e2e-admin")).count).toBe(first.count); // someone else still has it as new

    const afterAll = NewBookingsSchema.parse(await (await call("POST", "/bookings/seen", { body: { all: true } })).json());
    expect(afterAll).toEqual({ count: 0, items: [] });
    const overview = OverviewSchema.parse(await (await call("GET", "/overview")).json());
    expect(overview.cards.newSinceLastVisit).toBe(0);
  });

  it("rejects a seen request that names neither or both of references and all", async () => {
    for (const body of [{}, { all: true, references: ["ABCDEFGHJK"] }, { references: [] }]) {
      expect((await call("POST", "/bookings/seen", { body })).status).toBe(422);
    }
  });

  it("the demo gets the same views and nothing it does is stored", async () => {
    const before = await bell("cd_e2e-demo");
    expect(before.count).toBeGreaterThan(0);
    expect(before.count).toBeLessThanOrEqual(12);
    const after = NewBookingsSchema.parse(await (await call("POST", "/bookings/seen", { token: "cd_e2e-demo", body: { all: true } })).json());
    expect(after.count).toBe(before.count);
  });

  it("the Overview cards count today, tomorrow, the next seven days and this week's cancellations", async () => {
    const { cards, kpis } = OverviewSchema.parse(await (await call("GET", "/overview")).json());
    expect(cards.today).toBe(kpis.appointments.value);
    expect(cards.tomorrow).toBeGreaterThan(0);
    expect(cards.next7Days).toBeGreaterThanOrEqual(cards.tomorrow);
    expect(cards.cancelledThisWeek).toBeGreaterThanOrEqual(kpis.cancellations.value ?? 0);
  });
});
