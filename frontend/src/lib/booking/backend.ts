import "server-only";

import { ApiError } from "@/lib/api/http";
import { getApiBase, getProxySecret } from "@/lib/api/config";

// The only module besides `lib/api/http.ts` that calls `fetch`. It speaks to the booking endpoints of
// the backend as the website server: it adds the proxy secret and the visitor's address, never logs
// a request or response body, and never echoes a header.

export type BackendResult = {
  status: number;
  /** Parsed JSON, or null when the body is empty or not JSON. The caller validates it with zod. */
  body: unknown;
  retryAfter?: string;
  requestId?: string;
};

export type BackendCall = {
  method: "GET" | "POST";
  /** Path under `/api/v1`, for example `/appointments`. */
  path: `/${string}`;
  body?: unknown;
  idempotencyKey?: string;
  clientIp: string;
  requestId: string;
  timeoutMs: number;
};

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** Replaces the value part of a path so a log line never carries a booking reference. */
function pathTemplate(path: string): string {
  return path.replace(/^(\/appointments)\/[^/?]+/, "$1/{reference}").replace(/^(\/doctors)\/[^/?]+/, "$1/{slug}").split("?")[0] ?? path;
}

function errorCode(body: unknown): string | undefined {
  const error = (body as { error?: { code?: unknown } } | null)?.error;
  return typeof error?.code === "string" ? error.code : undefined;
}

export async function callBooking(call: BackendCall): Promise<BackendResult> {
  const base = getApiBase();
  const secret = getProxySecret();
  if (!base || !secret) throw new ApiError("unconfigured");

  const headers: Record<string, string> = {
    accept: "application/json",
    "x-proxy-secret": secret,
    "x-client-ip": call.clientIp,
    "x-request-id": call.requestId,
  };
  if (call.body !== undefined) headers["content-type"] = "application/json";
  if (call.idempotencyKey) headers["idempotency-key"] = call.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${base}/api/v1${call.path}`, {
      method: call.method,
      cache: "no-store",
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      signal: AbortSignal.timeout(call.timeoutMs),
    });
  } catch (error) {
    throw new ApiError(isAbort(error) ? "timeout" : "network");
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const retryAfter = res.headers.get("retry-after") ?? undefined;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (error) {
    if (isAbort(error)) throw new ApiError("timeout", { requestId });
    // An empty or non-JSON body stays null; the caller treats a 2xx without a valid body as invalid.
  }

  if (res.status >= 500) {
    console.error("booking backend error", {
      path: pathTemplate(call.path),
      status: res.status,
      code: errorCode(body),
      requestId,
    });
  }
  return { status: res.status, body, retryAfter, requestId };
}

/** The visitor's address as seen by the platform: first valid `x-forwarded-for` entry, else `x-real-ip`. */
export function clientIpFrom(headers: Headers): string {
  const candidates = [...(headers.get("x-forwarded-for") ?? "").split(","), headers.get("x-real-ip") ?? ""];
  for (const raw of candidates) {
    const value = raw.trim();
    if (isIp(value)) return value;
  }
  return "unknown";
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+(%\w+)?$/;

function isIp(value: string): boolean {
  if (!value) return false;
  if (IPV4.test(value)) return true;
  return value.includes(":") && IPV6.test(value) && value.split(":").length <= 8 && value.length <= 45;
}
