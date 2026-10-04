// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMockServer } from "../mock-api/server.mjs";
import { AppointmentViewSchema, BookingConflictSchema, DoctorSlotsSchema } from "@/lib/booking/schemas";

import { readApiFixture } from "./helpers/api-contract";

interface MockServer {
  listen(port: number, host: string, cb: () => void): void;
  close(cb?: () => void): void;
  closeAllConnections(): void;
  address(): AddressInfo;
  state: { mode: string };
}

let server: MockServer;
let base: string;

async function start(startMode?: string, options: { now?: string; proxySecret?: string } = {}) {
  server = createMockServer({ ...(startMode ? { startMode } : {}), ...options }) as unknown as MockServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

async function setMode(mode: string, resources?: string[]) {
  const res = await fetch(`${base}/__mode`, { method: "POST", body: JSON.stringify({ mode, resources }) });
  expect(res.status).toBe(204);
}

const get = (path: string) => fetch(`${base}/api/v1${path}`);

beforeEach(async () => {
  await start();
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("mock API: ok mode", () => {
  it("serves every endpoint from the fixtures with X-Request-ID and JSON", async () => {
    const res = await get("/clinic");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await res.json()).toEqual(readApiFixture("clinic"));

    for (const [path, name] of [
      ["/clinic/rules", "clinic-rules"],
      ["/departments", "departments"],
      ["/doctors", "doctors"],
      ["/lab-test-categories", "lab-test-categories"],
      ["/lab-tests", "lab-tests"],
      ["/health-packages", "health-packages"],
    ] as const) {
      const body = (await (await get(`${path}?pageSize=100`)).json()) as { items: unknown[]; total: number };
      const fixture = readApiFixture(name) as { items: unknown[]; total: number };
      expect(body.items, path).toEqual(fixture.items);
      expect(body.total, path).toBe(fixture.total);
    }
  });

  it("honours page and pageSize and returns the paging envelope", async () => {
    const body = (await (await get("/lab-tests?page=2&pageSize=5")).json()) as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    const all = (readApiFixture("lab-tests") as { items: unknown[] }).items;
    expect(body).toMatchObject({ page: 2, pageSize: 5, total: all.length });
    expect(body.items).toEqual(all.slice(5, 10));
  });

  it("answers the health check and 404 for unknown paths", async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
    expect((await get("/nothing")).status).toBe(404);
  });
});

describe("mock API: modes", () => {
  it("down destroys the connection", async () => {
    await setMode("down");
    await expect(get("/doctors")).rejects.toThrow();
  });

  it("error500 returns 500 with the standard error JSON", async () => {
    await setMode("error500");
    const res = await get("/doctors");
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: "internal_error" } });
  });

  it("malformed returns 200 with a body missing a required field", async () => {
    await setMode("malformed");
    const list = await get("/doctors");
    expect(list.status).toBe(200);
    expect(await list.json()).not.toHaveProperty("items");
    const clinic = await get("/clinic");
    expect(await clinic.json()).not.toHaveProperty("name");
  });

  it("partial fails departments only", async () => {
    await setMode("partial");
    expect((await get("/departments")).status).toBe(500);
    expect((await get("/doctors")).status).toBe(200);
    expect((await get("/clinic")).status).toBe(200);
  });

  it("extra adds dr-test-new to doctors", async () => {
    await setMode("extra");
    const body = (await (await get("/doctors?pageSize=100")).json()) as { items: Array<{ slug: string }>; total: number };
    expect(body.items.map((d) => d.slug)).toContain("dr-test-new");
    expect(body.total).toBe(body.items.length);
  });

  it("rename changes the first featured doctor", async () => {
    await setMode("rename");
    const body = (await (await get("/doctors?pageSize=100")).json()) as {
      items: Array<{ fullName: string; isFeatured: boolean }>;
    };
    expect(body.items.find((d) => d.isFeatured)?.fullName).toBe("Dr Renamed Test");
    expect(body.items.filter((d) => d.fullName === "Dr Renamed Test")).toHaveLength(1);
  });

  it("rules-empty empties the rules", async () => {
    await setMode("rules-empty");
    expect(await (await get("/clinic/rules")).json()).toMatchObject({ items: [], total: 0 });
  });

  it("rebrand changes the clinic and adds a sixth rule", async () => {
    await setMode("rebrand");
    const clinic = (await (await get("/clinic")).json()) as { name: string; emergencyPhone: { tel: string } };
    const original = readApiFixture("clinic") as { name: string; emergencyPhone: { tel: string } };
    expect(clinic.name).not.toBe(original.name);
    expect(clinic.emergencyPhone.tel).not.toBe(original.emergencyPhone.tel);
    const rules = (await (await get("/clinic/rules")).json()) as { items: unknown[] };
    expect(rules.items).toHaveLength(6);
  });

  it("slow waits and stops when the client disconnects", async () => {
    await setMode("slow");
    const pending = get("/doctors").catch(() => "aborted");
    const started = Date.now();
    const raced = await Promise.race([pending, new Promise((r) => setTimeout(() => r("still waiting"), 300))]);
    expect(raced).toBe("still waiting");
    expect(Date.now() - started).toBeLessThan(5000);
    server.closeAllConnections(); // simulates the client giving up; must not leave the server hanging
  });

  it("applies a mode only to the given resources", async () => {
    await setMode("error500", ["doctors"]);
    expect((await get("/doctors")).status).toBe(500);
    expect((await get("/departments")).status).toBe(200);
  });

  it("rejects an unknown mode", async () => {
    const res = await fetch(`${base}/__mode`, { method: "POST", body: JSON.stringify({ mode: "bogus" }) });
    expect(res.status).toBe(400);
  });

  it("GET /__mode returns the current mode", async () => {
    await setMode("rename");
    expect(await (await fetch(`${base}/__mode`)).json()).toMatchObject({ mode: "rename" });
  });
});

describe("mock API: start mode, log and reset", () => {
  it("starts in the mode given by MOCK_API_MODE", async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const previous = process.env.MOCK_API_MODE;
    process.env.MOCK_API_MODE = "partial";
    try {
      await start();
    } finally {
      if (previous === undefined) delete process.env.MOCK_API_MODE;
      else process.env.MOCK_API_MODE = previous;
    }
    expect((await get("/departments")).status).toBe(500);
  });

  it("counts catalog requests per resource and ignores control endpoints", async () => {
    await get("/doctors");
    await get("/doctors?page=1");
    await get("/clinic");
    await fetch(`${base}/__mode`);
    expect(await (await fetch(`${base}/__log`)).json()).toEqual({ doctors: 2, clinic: 1 });
  });

  it("counts requests that fail too", async () => {
    await setMode("error500");
    await get("/lab-tests");
    expect(await (await fetch(`${base}/__log`)).json()).toEqual({ "lab-tests": 1 });
  });

  it("__reset restores ok and clears the log", async () => {
    await setMode("error500");
    await get("/doctors");
    expect((await fetch(`${base}/__reset`, { method: "POST" })).status).toBe(204);
    expect(await (await fetch(`${base}/__log`)).json()).toEqual({});
    expect((await get("/doctors")).status).toBe(200);
    expect(server.state.mode).toBe("ok");
  });
});

describe("mock API: booking", () => {
  const SECRET = "fake-mock-proxy-secret-0123456789abcdef";
  const NOW = "2026-10-05T04:00:00Z"; // Monday 09:00 in Asia/Karachi
  const KEY_A = "4d6f0a52-5c1f-4a0e-9a47-0c1d2e3f4a5b";
  const KEY_B = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  const DOCTOR = "dr-omar-sheikh"; // Tue 14-17 and 18-20 (a break), Thu, Sat
  const TUESDAY = "2026-10-06";
  const FIRST_SLOT = "2026-10-06T09:00:00Z"; // 14:00 PKT

  const details = { fullName: "Ali Khan", mobile: "0300 1234567", email: "ali@example.test", reason: "Cough" };
  const book = (key: string | null, extra: Record<string, unknown> = {}, secret: string | null = SECRET) =>
    fetch(`${base}/api/v1/appointments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-proxy-secret": secret } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      body: JSON.stringify({ doctorSlug: DOCTOR, startsAt: FIRST_SLOT, acceptRules: true, ...details, ...extra }),
    });
  const slots = (secret: string | null = SECRET, doctor = DOCTOR) =>
    fetch(`${base}/api/v1/doctors/${doctor}/slots`, { headers: secret ? { "x-proxy-secret": secret } : {} });
  const lookup = (ref: string, secret: string | null = SECRET) =>
    fetch(`${base}/api/v1/appointments/${ref}`, { headers: secret ? { "x-proxy-secret": secret } : {} });
  const slotTimes = async () => {
    const body = DoctorSlotsSchema.parse(await (await slots()).json());
    return body.days.flatMap((d) => d.slots.map((s) => s.startsAt));
  };

  beforeEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await start(undefined, { now: NOW, proxySecret: SECRET });
  });

  it("lists 14 days of slots that validate with DoctorSlotsSchema, with the Tuesday break", async () => {
    const res = await slots();
    expect(res.status).toBe(200);
    const body = DoctorSlotsSchema.parse(await res.json());
    expect(body).toMatchObject({ doctorSlug: DOCTOR, timeZone: "Asia/Karachi", windowDays: 14, generatedAt: NOW });
    expect(body.days).toHaveLength(14);
    expect(body.days[0]).toMatchObject({ date: "2026-10-05", weekday: "mon", status: "not_working", slots: [] });
    const tuesday = body.days[1];
    expect(tuesday).toMatchObject({ date: TUESDAY, weekday: "tue", status: "available" });
    const times = tuesday?.slots.map((s) => s.localTime) ?? [];
    expect(times[0]).toBe("14:00");
    expect(times).toContain("16:45");
    expect(times.filter((t) => t >= "17:00" && t < "18:00")).toEqual([]);
    expect(times).toContain("18:00");
    expect(times.at(-1)).toBe("19:45");
  });

  it("answers an unknown doctor with 404", async () => {
    expect((await slots(SECRET, "dr-nobody")).status).toBe(404);
  });

  it("books a slot: 201 with a masked view, and the time disappears", async () => {
    expect(await slotTimes()).toContain(FIRST_SLOT);
    const res = await book(KEY_A);
    expect(res.status).toBe(201);
    const view = AppointmentViewSchema.parse(await res.json());
    expect(view).toMatchObject({
      status: "confirmed",
      doctor: { slug: DOCTOR },
      localDate: TUESDAY,
      localTime: "14:00",
      timeZone: "Asia/Karachi",
      feePkr: 1800,
      patientNameMasked: "A**** K****",
      mobileMasked: "0300****567",
      isSample: true,
    });
    expect(view.reference).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(await slotTimes()).not.toContain(FIRST_SLOT);
  });

  it("replays the same reference for the same key, and refuses the key with other details", async () => {
    const first = await (await book(KEY_A)).json();
    const again = await book(KEY_A);
    expect(again.status).toBe(201);
    expect((await again.json()).reference).toBe(first.reference);
    const other = await book(KEY_A, { reason: "Something else" });
    expect(other.status).toBe(409);
    expect((await other.json()).error.code).toBe("idempotency_key_reused");
  });

  it("answers a second key for the same slot with 409 slot_taken and up to 5 alternatives", async () => {
    await book(KEY_A);
    const res = await book(KEY_B, { mobile: "03007654321" });
    expect(res.status).toBe(409);
    const body = BookingConflictSchema.parse(await res.json());
    expect(body.error.code).toBe("slot_taken");
    expect(body.alternatives?.length).toBeGreaterThan(0);
    expect(body.alternatives?.length).toBeLessThanOrEqual(5);
    expect(body.alternatives?.every((a) => Date.parse(a.startsAt) > Date.parse(FIRST_SLOT))).toBe(true);
  });

  it("refuses a time that is not on offer with slot_unavailable", async () => {
    const res = await book(KEY_A, { startsAt: "2026-10-06T12:00:00Z" }); // 17:00 PKT, inside the break
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("slot_unavailable");
  });

  it("validates the body, the key and the trap field", async () => {
    const bad = await book(KEY_A, { acceptRules: false, fullName: "A" });
    expect(bad.status).toBe(422);
    const fields = ((await bad.json()).error.details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["acceptRules", "fullName"]));
    expect((await book(null)).status).toBe(422);
    expect((await book("not-a-uuid")).status).toBe(422);
    const trap = await book(KEY_A, { trap: "x" });
    expect(trap.status).toBe(400);
    expect((await trap.json()).error.code).toBe("request_rejected");
  });

  it("looks a booking up by reference, in any case and with or without the dash", async () => {
    const view = await (await book(KEY_A)).json();
    const compact = (view.reference as string).replace("-", "");
    for (const ref of [view.reference, compact.toLowerCase(), compact]) {
      const res = await lookup(ref);
      expect(res.status).toBe(200);
      expect(AppointmentViewSchema.parse(await res.json()).reference).toBe(view.reference);
    }
    expect((await lookup("ZZZZZ-ZZZZZ")).status).toBe(404);
  });

  it("refuses every booking route without the right proxy secret", async () => {
    for (const secret of [null, "wrong-secret"]) {
      expect((await slots(secret)).status).toBe(403);
      expect((await book(KEY_A, {}, secret)).status).toBe(403);
      expect((await lookup("ABCDEFGHJK", secret)).status).toBe(403);
    }
    expect(await slotTimes()).toContain(FIRST_SLOT);
  });

  it("booking-down refuses the connection on booking routes only", async () => {
    await setMode("booking-down");
    await expect(slots()).rejects.toThrow();
    await expect(book(KEY_A)).rejects.toThrow();
    expect((await get("/clinic")).status).toBe(200);
  });

  it("booking-slow keeps the request waiting, and a client that gives up books nothing", async () => {
    await setMode("booking-slow");
    await expect(
      fetch(`${base}/api/v1/appointments`, {
        method: "POST",
        headers: { "x-proxy-secret": SECRET, "idempotency-key": KEY_A, "content-type": "application/json" },
        body: JSON.stringify({ doctorSlug: DOCTOR, startsAt: FIRST_SLOT, acceptRules: true, ...details }),
        signal: AbortSignal.timeout(300),
      }),
    ).rejects.toThrow();
    await setMode("ok");
    expect(await slotTimes()).toContain(FIRST_SLOT);
    expect((await book(KEY_A)).status).toBe(201);
  });

  it("slot-taken makes only the next POST lose", async () => {
    await setMode("slot-taken");
    const lost = await book(KEY_A);
    expect(lost.status).toBe(409);
    const body = BookingConflictSchema.parse(await lost.json());
    expect(body.error.code).toBe("slot_taken");
    expect(body.alternatives?.length).toBeGreaterThan(0);
    expect(await slotTimes()).not.toContain(FIRST_SLOT);
    const next = body.alternatives?.[0];
    const won = await book(KEY_B, { startsAt: next?.startsAt });
    expect(won.status).toBe(201);
  });

  it("rate-limited answers a POST with 429 and Retry-After, but still serves slots", async () => {
    await setMode("rate-limited");
    const res = await book(KEY_A);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await res.json()).error.code).toBe("rate_limited");
    expect((await slots()).status).toBe(200);
  });

  it("logs method, path and mode, never a body", async () => {
    await book(KEY_A);
    await slots();
    const log = await (await fetch(`${base}/__log`)).json();
    expect(log.booking).toEqual([
      { method: "POST", path: "/appointments", mode: "ok", idempotencyKey: KEY_A },
      { method: "GET", path: "/doctors/{slug}/slots", mode: "ok" },
    ]);
    const text = JSON.stringify(log);
    for (const personal of ["Ali Khan", "03001234567", "0300 1234567", "ali@example.test", "Cough", DOCTOR]) {
      expect(text).not.toContain(personal);
    }
  });

  it("/__reset clears bookings and the log", async () => {
    await book(KEY_A);
    expect(await slotTimes()).not.toContain(FIRST_SLOT);
    expect((await fetch(`${base}/__reset`, { method: "POST" })).status).toBe(204);
    expect(await slotTimes()).toContain(FIRST_SLOT);
    expect((await (await fetch(`${base}/__log`)).json()).booking).toEqual([{ method: "GET", path: "/doctors/{slug}/slots", mode: "ok" }]);
  });
});
