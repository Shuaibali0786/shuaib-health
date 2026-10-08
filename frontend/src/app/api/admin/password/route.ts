import * as z from "zod";

import { SESSION_COOKIE } from "@/admin/lib/cookie";
import { SessionIssuedSchema } from "@/admin/lib/schemas";
import { callAdminBackend } from "@/admin/lib/server";
import { clearedSessionCookie, cookieValue, isSameOrigin, readJsonBody, sessionCookie } from "@/admin/lib/sessionRoute";
import { ApiError } from "@/lib/api/http";
import { clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";

// Change password (contracts/website-admin.md §3). The backend ends every session of the person and
// issues a fresh one; its token replaces the cookie here and the browser receives the `viewer` only.

export const dynamic = "force-dynamic";

const Body = z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(12).max(128) }).strict();
const PASS_THROUGH = new Set([401, 403, 422, 429, 503]);

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  const sessionToken = cookieValue(request, SESSION_COOKIE);
  if (!sessionToken) return errorJson(401, "not_signed_in", "Please sign in.", requestId);
  const read = await readJsonBody(request, 1024);
  if (!read.ok) return errorJson(read.status, read.code, read.message, requestId);
  const body = Body.safeParse(read.value);
  if (!body.success) return errorJson(422, "validation_error", "Check the passwords and try again.", requestId);

  let result;
  try {
    result = await callAdminBackend({
      method: "POST",
      path: "/admin/auth/change-password",
      template: "/admin/auth/change-password",
      body: body.data,
      sessionToken,
      csrfToken: request.headers.get("x-csrf-token") ?? undefined,
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: 10000,
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "timeout") return errorJson(504, "timeout", "The service took too long to answer.", requestId);
    if (error instanceof ApiError) return errorJson(502, "upstream_error", "The service did not answer.", requestId);
    throw error;
  }

  if (result.status === 200) {
    const issued = SessionIssuedSchema.safeParse(result.body);
    if (!issued.success) return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
    return noStoreJson(issued.data.viewer, 200, { "set-cookie": sessionCookie(issued.data.token) });
  }
  if (!PASS_THROUGH.has(result.status) || result.body === null) {
    return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
  }
  const headers: Record<string, string> = {};
  if (result.retryAfter) headers["retry-after"] = result.retryAfter;
  if (result.status === 401) headers["set-cookie"] = clearedSessionCookie();
  return noStoreJson(result.body, result.status, headers);
}
