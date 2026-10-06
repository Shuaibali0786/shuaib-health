// Mock catalog API for end-to-end tests (contracts: specs/004-catalog-api-integration/contracts/mock-api.md and
// specs/005-appointment-booking/contracts/website-booking.md §5 for the booking routes, see booking.mjs).
// Node built-ins only. Playwright cannot intercept fetches made by the Next server, so the e2e
// servers point CATALOG_API_URL here. Never used in production.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ADMIN_MODES, ADMIN_SLOW_MS, createAdmin } from "./admin.mjs";
import { BOOKING_MODES, BOOKING_SLOW_MS, createBooking } from "./booking.mjs";

const FIXTURES = fileURLToPath(new URL("../fixtures/api/", import.meta.url));

export const MODES = [
  "ok",
  "down",
  "slow",
  "error500",
  "malformed",
  "partial",
  "extra",
  "rename",
  "rules-empty",
  "rebrand",
  ...BOOKING_MODES,
  ...ADMIN_MODES,
];

// Modes that only change the booking or the staff-app routes; the catalog behaves as in "ok".
const NON_CATALOG_MODES = [...BOOKING_MODES, ...ADMIN_MODES];

// URL path (after /api/v1) -> fixture / resource name.
const ROUTES = {
  "/clinic": "clinic",
  "/clinic/rules": "clinic-rules",
  "/departments": "departments",
  "/doctors": "doctors",
  "/lab-test-categories": "lab-test-categories",
  "/lab-tests": "lab-tests",
  "/health-packages": "health-packages",
};
const RESOURCES = Object.values(ROUTES);

const SLOW_MS = 60_000;

function fixture(name) {
  return JSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8"));
}

/** The body for `resource` in the `ok` state, with the data changes of the data modes applied. */
function dataFor(resource, mode) {
  const data = fixture(resource);
  if (mode === "extra" && resource === "doctors") {
    const template = data.items[0];
    data.items.push({
      ...structuredClone(template),
      id: "00000000-0000-4000-8000-000000000001",
      slug: "dr-test-new",
      fullName: "Dr Test New",
      isFeatured: false,
    });
    data.total += 1;
  }
  if (mode === "rename" && resource === "doctors") {
    const featured = data.items.find((doctor) => doctor.isFeatured);
    if (featured) featured.fullName = "Dr Renamed Test";
  }
  if (mode === "rules-empty" && resource === "clinic-rules") {
    data.items = [];
    data.total = 0;
  }
  if (mode === "rebrand") {
    if (resource === "clinic") {
      data.name = "Rebranded Clinic";
      data.fullTitle = "Rebranded Clinic - Test City";
      data.emergencyPhone = { display: "+92 300 1234567", tel: "+923001234567" };
    }
    if (resource === "clinic-rules") {
      data.items.push({
        id: "00000000-0000-4000-8000-000000000002",
        sortOrder: data.items.length + 1,
        text: "Please bring your previous reports to the visit.",
        isSample: true,
      });
      data.total += 1;
    }
  }
  return data;
}

function malformed(resource, data) {
  if (resource === "clinic") {
    const rest = { ...data };
    delete rest.name;
    return rest;
  }
  const rest = { ...data };
  delete rest.items;
  return rest;
}

function slicePage(data, url) {
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const all = data.items;
  return { items: all.slice((page - 1) * pageSize, page * pageSize), total: data.total ?? all.length, page, pageSize };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Create (but do not start) a mock server. `startMode` defaults to MOCK_API_MODE, then "ok".
 * Returns the http.Server; `server.state` exposes the mode and request log for tests.
 */
export function createMockServer({ startMode = process.env.MOCK_API_MODE || "ok", now, proxySecret } = {}) {
  const state = { mode: startMode, resources: null, log: {} };
  const slowTimers = new Set();
  const booking = createBooking({ now, proxySecret });
  const admin = createAdmin({ now, proxySecret });
  if (startMode === "slot-taken") booking.armSlotTaken();

  const appliesTo = (resource) => !state.resources || state.resources.includes(resource);

  function send(res, status, body, extraHeaders = {}) {
    const text = body === undefined ? "" : JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "X-Request-ID": randomUUID(),
      ...extraHeaders,
    });
    res.end(text);
  }

  function catalog(req, res, url, resource) {
    state.log[resource] = (state.log[resource] ?? 0) + 1;
    // The booking modes only affect the booking routes; the catalog behaves as in "ok".
    const mode = appliesTo(resource) && !NON_CATALOG_MODES.includes(state.mode) ? state.mode : "ok";

    if (mode === "down") {
      req.socket.destroy();
      return;
    }
    if (mode === "error500" || (mode === "partial" && resource === "departments")) {
      send(res, 500, { error: { code: "internal_error", message: "Mock failure", requestId: "mock" } });
      return;
    }

    const data = dataFor(resource, mode);
    const isList = Array.isArray(data.items);
    let body = isList ? slicePage(data, url) : data;
    if (mode === "malformed") body = malformed(resource, body);

    if (mode === "slow") {
      const timer = setTimeout(() => {
        slowTimers.delete(timer);
        if (!res.destroyed) send(res, 200, body);
      }, SLOW_MS);
      slowTimers.add(timer);
      // Stop waiting when the client gives up.
      res.on("close", () => {
        clearTimeout(timer);
        slowTimers.delete(timer);
      });
      return;
    }
    send(res, 200, body);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (path === "/__mode" && req.method === "POST") {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        body = null;
      }
      const resources = body?.resources;
      const validResources = resources === undefined || (Array.isArray(resources) && resources.every((r) => RESOURCES.includes(r)));
      if (!body || !MODES.includes(body.mode) || !validResources) {
        send(res, 400, { error: { code: "validation_error", message: `mode must be one of ${MODES.join(", ")}` } });
        return;
      }
      state.mode = body.mode;
      state.resources = resources ?? null;
      if (body.mode === "slot-taken") booking.armSlotTaken();
      res.writeHead(204).end();
      return;
    }
    if (path === "/__mode" && req.method === "GET") {
      send(res, 200, { mode: state.mode, resources: state.resources });
      return;
    }
    if (path === "/__reset" && req.method === "POST") {
      state.mode = "ok";
      state.resources = null;
      state.log = {};
      booking.reset();
      admin.reset();
      res.writeHead(204).end();
      return;
    }
    if (path === "/__log" && req.method === "GET") {
      send(res, 200, state.log);
      return;
    }
    if (path === "/" && req.method === "GET") {
      send(res, 200, { status: "ok", mode: state.mode });
      return;
    }

    if (path === "/__admin/new-booking" && req.method === "POST") {
      // Test seeding: a fresh future booking for one test to own (the admin specs run in parallel).
      const body = JSON.parse((await readBody(req)) || "{}");
      send(res, 200, { reference: admin.newBooking(body) });
      return;
    }

    if (path.startsWith("/api/v1/admin/")) {
      const mode = ADMIN_MODES.includes(state.mode) ? state.mode : "ok";
      const bodyText = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : "";
      const call = admin.handle({ method: req.method ?? "GET", path, headers: req.headers, bodyText, mode });
      (state.log.admin ??= []).push(call.entry);
      if (mode === "admin-down") {
        req.socket.destroy();
        return;
      }
      const respond = () => {
        const result = call.run();
        send(res, result.status, result.body, result.headers);
      };
      if (mode === "admin-slow") {
        const timer = setTimeout(() => {
          slowTimers.delete(timer);
          if (!res.destroyed) respond();
        }, ADMIN_SLOW_MS);
        slowTimers.add(timer);
        res.on("close", () => {
          clearTimeout(timer);
          slowTimers.delete(timer);
        });
        return;
      }
      respond();
      return;
    }

    if (path.startsWith("/api/v1/")) {
      const bodyText = req.method === "POST" ? await readBody(req) : "";
      const mode = BOOKING_MODES.includes(state.mode) ? state.mode : "ok";
      const call = booking.handle({ method: req.method ?? "GET", path, headers: req.headers, bodyText, mode });
      if (call) {
        // The log records method, path template, mode and the idempotency key; never a body.
        (state.log.booking ??= []).push(call.entry);
        if (mode === "booking-down") {
          req.socket.destroy();
          return;
        }
        const respond = () => {
          const result = call.run();
          if (result.resetMode) state.mode = "ok";
          send(res, result.status, result.body, result.headers);
        };
        if (mode === "booking-slow") {
          const timer = setTimeout(() => {
            slowTimers.delete(timer);
            if (!res.destroyed) respond();
          }, BOOKING_SLOW_MS);
          slowTimers.add(timer);
          // A client that gave up creates no booking.
          res.on("close", () => {
            clearTimeout(timer);
            slowTimers.delete(timer);
          });
          return;
        }
        respond();
        return;
      }
    }

    if (req.method === "GET" && path.startsWith("/api/v1/")) {
      const resource = ROUTES[path.slice("/api/v1".length)];
      if (resource) {
        catalog(req, res, url, resource);
        return;
      }
    }
    send(res, 404, { error: { code: "not_found", message: "Not found", requestId: "mock" } });
  });

  server.state = state;
  server.on("close", () => {
    for (const timer of slowTimers) clearTimeout(timer);
    slowTimers.clear();
  });
  return server;
}

// Run directly: `node tests/mock-api/server.mjs`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.MOCK_API_PORT) || 4010;
  const server = createMockServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`mock catalog API on http://127.0.0.1:${port} (mode: ${server.state.mode})`);
  });
}
