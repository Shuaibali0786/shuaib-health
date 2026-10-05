// Helpers for stateful specs to drive the mock catalog API (tests/mock-api/server.mjs).
// Only stateful specs may switch modes: the main config assumes the mock stays in "ok".

export type MockMode =
  | "ok"
  | "down"
  | "slow"
  | "error500"
  | "malformed"
  | "partial"
  | "extra"
  | "rename"
  | "rules-empty"
  | "rebrand"
  | "booking-down"
  | "booking-slow"
  | "slot-taken"
  | "rate-limited";

export async function setMode(apiBase: string, mode: MockMode, resources?: string[]): Promise<void> {
  const res = await fetch(`${apiBase}/__mode`, { method: "POST", body: JSON.stringify({ mode, resources }) });
  if (res.status !== 204) throw new Error(`mock API refused mode ${mode}: ${res.status}`);
}

/** Back to "ok" and an empty request log. */
export async function resetMode(apiBase: string): Promise<void> {
  const res = await fetch(`${apiBase}/__reset`, { method: "POST" });
  if (res.status !== 204) throw new Error(`mock API reset failed: ${res.status}`);
}

/** Catalog requests per resource since the last reset, for example `{ doctors: 2 }`. */
export async function requestLog(apiBase: string): Promise<Record<string, number>> {
  const res = await fetch(`${apiBase}/__log`);
  return (await res.json()) as Record<string, number>;
}
