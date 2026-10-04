import "server-only";

import type { z } from "zod";

import { getApiBase } from "./config";

export type ApiErrorKind = "unconfigured" | "network" | "timeout" | "status" | "invalid";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** For kind "status". */
  readonly status?: number;
  /** From the X-Request-ID response header, for logs. */
  readonly requestId?: string;

  constructor(kind: ApiErrorKind, extra: { status?: number; requestId?: string } = {}) {
    super(`catalog api ${kind}${extra.status ? ` ${extra.status}` : ""}`);
    this.name = "ApiError";
    this.kind = kind;
    this.status = extra.status;
    this.requestId = extra.requestId;
  }
}

const DEFAULT_TIMEOUT_MS = 3000;

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * GET `${CATALOG_API_URL}/api/v1${path}` and validate the body. This is the only `fetch` call in
 * `src/`. Callers that fetch several pages pass one shared `signal` so a whole list has one 3 s budget.
 */
export async function getJson<T>(path: `/${string}`, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const base = getApiBase();
  if (!base) throw new ApiError("unconfigured");

  let requestId: string | undefined;
  let body: unknown;
  try {
    const res = await fetch(`${base}/api/v1${path}`, {
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    requestId = res.headers.get("x-request-id") ?? undefined;
    if (!res.ok) throw new ApiError("status", { status: res.status, requestId });
    try {
      body = await res.json();
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new ApiError("invalid", { requestId });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(isAbort(error) ? "timeout" : "network", { requestId });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError("invalid", { requestId });
  return parsed.data;
}
