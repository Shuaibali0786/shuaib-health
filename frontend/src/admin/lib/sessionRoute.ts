import "server-only";

import { SESSION_COOKIE } from "./cookie";

// Shared by the staff app's route handlers (sign-in/out, password, and the catch-all proxy): the same
// guards and the same cookie attributes everywhere (contracts/website-admin.md §2 and §3).

/** CSRF guard (005 pattern): the browser sends `Origin` on every non-GET, and it must be this site. */
export function isSameOrigin(request: Request): boolean {
  if (request.headers.get("origin") !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

/** `__Host-` needs Secure, Path=/ and no Domain; no Max-Age, so it ends with the browser session. */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export function cookieValue(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}

/** Removes any `token` property so a session token can never reach the browser through a response. */
export function withoutToken(body: unknown): unknown {
  if (body && typeof body === "object" && !Array.isArray(body) && "token" in body) {
    const rest = { ...(body as Record<string, unknown>) };
    delete rest.token;
    return rest;
  }
  return body;
}

export type ReadJson = { ok: true; value: unknown } | { ok: false; status: 413 | 415 | 422; code: string; message: string };

/** Reads a small JSON body: size limit first, then media type, then syntax. */
export async function readJsonBody(request: Request, limit: number): Promise<ReadJson> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) return { ok: false, status: 413, code: "payload_too_large", message: "The request is too large." };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) {
    return { ok: false, status: 413, code: "payload_too_large", message: "The request is too large." };
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, status: 415, code: "unsupported_media_type", message: "Send the request as JSON." };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 422, code: "validation_error", message: "The request is not valid JSON." };
  }
}
