// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMockServer } from "../mock-api/server.mjs";
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

async function start(startMode?: string) {
  server = createMockServer(startMode ? { startMode } : undefined) as unknown as MockServer;
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
