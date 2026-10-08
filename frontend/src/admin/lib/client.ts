// Browser calls from the Command Centre to this site's own `/api/admin/*` route (the BFF). The browser
// never talks to the backend; the route adds the proxy secret and the session token from the cookie.
// This is one of two `fetch` call sites for the staff app (the other is src/admin/lib/server.ts).
import * as z from "zod";

import { ErrorResponseSchema } from "./schemas";

type ErrorCode = z.infer<typeof ErrorResponseSchema>["error"]["code"];

/** What the screens know about a failed call; they branch on `code`, never on message text. */
export class AdminApiError extends Error {
  readonly status: number;
  /** The backend's error code, or `"network"` / `"timeout"` / `"invalid_response"` for failures without one. */
  readonly code: ErrorCode | "network" | "timeout" | "invalid_response" | "upstream_error";
  readonly retryAfter: number | null;
  readonly body: unknown;

  constructor(status: number, code: AdminApiError["code"], retryAfter: number | null = null, body: unknown = null) {
    super(`admin api ${status} ${code}`);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.body = body;
  }

  get isSessionEnded(): boolean {
    return this.code === "session_expired" || this.code === "not_signed_in";
  }
}

let csrfToken: string | null = null;
const sessionEndedListeners = new Set<(code: AdminApiError["code"]) => void>();

/** Called when any request finds the session over (401), so one dialog can offer sign-in again. */
export function onSessionEnded(listener: (code: AdminApiError["code"]) => void): () => void {
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
  };
}

/** The session's CSRF token, learned from `me` / sign-in. It is sent as `X-CSRF-Token` on every non-GET. */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export type AdminRequest = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path after `/api/admin/`, for example `"overview"` or `"bookings/search"`. */
  path: string;
  body?: unknown;
  signal?: AbortSignal;
};

function retryAfterSeconds(res: Response): number | null {
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header : null;
}

/** Sends one request and validates the answer. Throws `AdminApiError` for every failure. */
export async function adminRequest<T>(request: AdminRequest, schema: z.ZodType<T>): Promise<T> {
  const method = request.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (method !== "GET") {
    if (request.body !== undefined) headers["content-type"] = "application/json";
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
  }

  let res: Response;
  try {
    res = await fetch(`/api/admin/${request.path}`, {
      method,
      cache: "no-store",
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApiError(0, error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network");
  }

  let body: unknown = null;
  try {
    if (res.status !== 204) body = await res.json();
  } catch {
    // An empty or non-JSON body stays null.
  }

  if (!res.ok) {
    const parsed = ErrorResponseSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : res.status >= 500 ? "upstream_error" : "invalid_response";
    const failure = new AdminApiError(res.status, code, retryAfterSeconds(res), body);
    // Only a request made with a session can end one; a failed sign-in is a 401 too.
    if (res.status === 401 && failure.isSessionEnded) for (const listener of sessionEndedListeners) listener(code);
    throw failure;
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AdminApiError(res.status, "invalid_response");
  return parsed.data;
}
