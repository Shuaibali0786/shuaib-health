import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { getApiBase, getProxySecret, protectionBypassHeaders } from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";
import { clientIpFrom } from "@/lib/booking/backend";
import { matchAdminRoute } from "./bffRoutes";
import { SESSION_COOKIE } from "./cookie";
import { ViewerSchema, type Viewer } from "./schemas";

// The only server-side module that calls the backend's Command Centre endpoints. Both the BFF route
// handler (browser calls) and server components (the layout's `me`, first paint data) go through it,
// so the allow-list in bffRoutes.ts applies to both. It never logs a body, a cookie or a token.

export type AdminBackendResult = {
  status: number;
  /** Parsed JSON, or null for an empty or non-JSON body. */
  body: unknown;
  retryAfter?: string;
  requestId?: string;
};

export type AdminBackendCall = {
  method: "GET" | "POST" | "PATCH";
  /** Backend path under `/api/v1`, already validated by the allow-list. */
  path: `/${string}`;
  /** Allow-list template of the path (placeholders, no query), the only form that is logged. */
  template: string;
  body?: unknown;
  sessionToken?: string;
  csrfToken?: string;
  clientIp: string;
  requestId: string;
  timeoutMs: number;
};

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export async function callAdminBackend(call: AdminBackendCall): Promise<AdminBackendResult> {
  const base = getApiBase();
  const secret = getProxySecret();
  if (!base || !secret) throw new ApiError("unconfigured");

  const headers: Record<string, string> = {
    accept: "application/json",
    ...protectionBypassHeaders(),
    "x-proxy-secret": secret,
    "x-client-ip": call.clientIp,
    "x-request-id": call.requestId,
  };
  if (call.sessionToken) headers["x-session-token"] = call.sessionToken;
  if (call.csrfToken) headers["x-csrf-token"] = call.csrfToken;
  if (call.body !== undefined) headers["content-type"] = "application/json";

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
  }

  if (res.status >= 500) {
    console.error("admin backend error", { path: call.template, status: res.status, requestId });
  }
  return { status: res.status, body, retryAfter, requestId };
}

/**
 * A GET for a server component, authenticated with the visitor's session cookie. `path` must be on the
 * allow-list (it is the browser form, for example `"me"` or `"insights?range=7"`).
 */
export async function adminGet(path: string): Promise<AdminBackendResult> {
  const [pathname = "", search] = path.split("?");
  const matched = matchAdminRoute("GET", pathname.split("/"), search);
  if (!matched || matched.invalid.length > 0) throw new ApiError("invalid");
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  return callAdminBackend({
    method: "GET",
    path: matched.backendPath as `/${string}`,
    template: matched.template,
    sessionToken,
    clientIp: clientIpFrom(await headers()),
    requestId: crypto.randomUUID(),
    timeoutMs: matched.route.timeoutMs,
  });
}

/**
 * A read sent as POST for a server component (the bookings search keeps personal search terms out of
 * addresses). The CSRF token is the signed-in viewer's own, which `me` returns to this server.
 */
export async function adminPostRead(path: string, body: unknown, csrfToken: string): Promise<AdminBackendResult> {
  const matched = matchAdminRoute("POST", path.split("/"));
  if (!matched || matched.invalid.length > 0) throw new ApiError("invalid");
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  return callAdminBackend({
    method: "POST",
    path: matched.backendPath as `/${string}`,
    template: matched.template,
    body,
    sessionToken,
    csrfToken,
    clientIp: clientIpFrom(await headers()),
    requestId: crypto.randomUUID(),
    timeoutMs: matched.route.timeoutMs,
  });
}

export type ViewerResult ={ kind: "ok"; viewer: Viewer } | { kind: "signed-out" } | { kind: "unavailable" };

/**
 * Who is looking at this page, asked of the backend once per request (React `cache` shares the answer
 * between the layout and the page). "signed-out" covers no session, an expired one and a refused one;
 * "unavailable" means the backend could not be asked or answered something unexpected.
 */
export const getViewer = cache(async (): Promise<ViewerResult> => {
  try {
    const result = await adminGet("me");
    if (result.status === 401) return { kind: "signed-out" };
    if (result.status === 200) {
      const parsed = ViewerSchema.safeParse(result.body);
      if (parsed.success) return { kind: "ok", viewer: parsed.data };
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  return { kind: "unavailable" };
});
