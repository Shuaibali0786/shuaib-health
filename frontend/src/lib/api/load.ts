import "server-only";

import { ApiError } from "./http";

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "unconfigured" | "unavailable" };

/**
 * Run a cached loader and never throw: a failure becomes `{ ok: false }` so the page can show a
 * friendly message for that section. Logs one line per failure with no URL, query or body (FR-016).
 */
export async function load<T>(name: string, fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const api = error instanceof ApiError ? error : null;
    const kind = api?.kind ?? "unknown";
    console.warn(
      JSON.stringify({ event: "catalog_api_unavailable", resource: name, kind, requestId: api?.requestId ?? null }),
    );
    return { ok: false, reason: kind === "unconfigured" ? "unconfigured" : "unavailable" };
  }
}
