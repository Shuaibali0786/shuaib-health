// The allow-list of the Command Centre BFF (specs/006-clinic-command-centre/contracts/website-admin.md §3).
// One table is used by the catch-all route handler and by src/admin/lib/server.ts, so a browser request
// and a server-component call can reach exactly the same backend endpoints and no others.
// Pure and framework-free: it only matches, validates and builds a backend path.

export type AdminMethod = "GET" | "POST" | "PATCH";

export type AdminRoute = {
  method: AdminMethod;
  /** Browser path after `/api/admin/`. `{ref}` is a booking reference, `{id}` a UUID. */
  browser: string;
  /** Backend path after `/api/v1`, with the same placeholders. */
  backend: string;
  /** Largest accepted request body in bytes. 0 means the request must have no body. */
  bodyLimit: number;
  timeoutMs: number;
  /** Query parameters the route accepts, each with its validator. Anything else is dropped. */
  query?: Record<string, (value: string) => boolean>;
};

export const REFERENCE = /^[0-9A-HJKMNP-TV-Z]{10}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const oneOf = (...allowed: string[]) => (value: string) => allowed.includes(value);
const uuid = (value: string) => UUID.test(value);
const pageNumber = (value: string) => /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 10000;

const KB = 1024;

export const ADMIN_ROUTES: readonly AdminRoute[] = [
  { method: "GET", browser: "me", backend: "/admin/auth/me", bodyLimit: 0, timeoutMs: 5000 },
  { method: "GET", browser: "lookups", backend: "/admin/lookups", bodyLimit: 0, timeoutMs: 5000 },
  { method: "GET", browser: "overview", backend: "/admin/overview", bodyLimit: 0, timeoutMs: 8000 },
  { method: "POST", browser: "bookings/search", backend: "/admin/bookings/search", bodyLimit: 2 * KB, timeoutMs: 8000 },
  { method: "GET", browser: "bookings/{ref}", backend: "/admin/bookings/{ref}", bodyLimit: 0, timeoutMs: 5000 },
  { method: "POST", browser: "bookings/{ref}/status", backend: "/admin/bookings/{ref}/status", bodyLimit: KB, timeoutMs: 10000 },
  { method: "POST", browser: "bookings/{ref}/status/undo", backend: "/admin/bookings/{ref}/status/undo", bodyLimit: KB, timeoutMs: 10000 },
  { method: "POST", browser: "bookings/{ref}/reveal-phone", backend: "/admin/bookings/{ref}/reveal-phone", bodyLimit: 0, timeoutMs: 5000 },
  { method: "GET", browser: "insights", backend: "/admin/insights", bodyLimit: 0, timeoutMs: 8000, query: { range: oneOf("7", "30", "90") } },
  { method: "GET", browser: "doctors-today", backend: "/admin/doctors-today", bodyLimit: 0, timeoutMs: 8000 },
  {
    method: "GET",
    browser: "activity",
    backend: "/admin/activity",
    bodyLimit: 0,
    timeoutMs: 8000,
    query: { action: (value) => /^[a-z_]+\.[a-z_]+$/.test(value), staffId: uuid, page: pageNumber },
  },
  { method: "GET", browser: "staff", backend: "/admin/staff", bodyLimit: 0, timeoutMs: 5000 },
  { method: "POST", browser: "staff", backend: "/admin/staff", bodyLimit: 2 * KB, timeoutMs: 10000 },
  { method: "POST", browser: "staff/{id}/reset-password", backend: "/admin/staff/{id}/reset-password", bodyLimit: KB, timeoutMs: 10000 },
  { method: "PATCH", browser: "staff/{id}", backend: "/admin/staff/{id}", bodyLimit: KB, timeoutMs: 10000 },
];

export type MatchedRoute = {
  route: AdminRoute;
  /** Backend path with placeholders filled and the validated query appended, for example `/admin/insights?range=7`. */
  backendPath: string;
  /** Backend path without the query, with values replaced by their placeholder, safe to log. */
  template: string;
  /** Names of accepted query parameters whose value failed validation; the handler answers 422. */
  invalid: string[];
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(ref|id)\}/g, (_, name: string) => encodeURIComponent(values[name] ?? ""));
}

/**
 * Finds the allow-listed route for a request, or `null` (the handler answers 404 without calling the
 * backend). A placeholder that fails its pattern is a miss, never a pass-through.
 */
export function matchAdminRoute(method: string, segments: readonly string[], search?: URLSearchParams | string): MatchedRoute | null {
  for (const route of ADMIN_ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.browser.split("/");
    if (pattern.length !== segments.length) continue;
    const values: Record<string, string> = {};
    const matches = pattern.every((part, index) => {
      const actual = segments[index] ?? "";
      if (part === "{ref}") return REFERENCE.test(actual) && ((values.ref = actual), true);
      if (part === "{id}") return UUID.test(actual) && ((values.id = actual), true);
      return part === actual;
    });
    if (!matches) continue;

    const params = new URLSearchParams(search ?? "");
    const kept = new URLSearchParams();
    const invalid: string[] = [];
    for (const [name, validate] of Object.entries(route.query ?? {})) {
      const value = params.get(name);
      if (value === null) continue;
      if (validate(value)) kept.set(name, value);
      else invalid.push(name);
    }
    const base = fill(route.backend, values);
    const query = kept.toString();
    return { route, backendPath: query ? `${base}?${query}` : base, template: route.backend, invalid };
  }
  return null;
}
