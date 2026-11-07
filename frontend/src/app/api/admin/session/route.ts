import * as z from "zod";

import { SESSION_COOKIE } from "@/admin/lib/cookie";
import { SessionIssuedSchema, TwoFactorChallengeSchema } from "@/admin/lib/schemas";
import { callAdminBackend } from "@/admin/lib/server";
import { challengeCookie, clearedSessionCookie, cookieValue, isSameOrigin, readJsonBody, sessionCookie } from "@/admin/lib/sessionRoute";
import { ApiError } from "@/lib/api/http";
import { clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";

// Sign-in (POST) and sign-out (DELETE) for the staff app (contracts/website-admin.md §3). The backend
// returns the session token to this server only: it goes into the __Host- cookie and the browser
// receives the `viewer` alone. Sign-out clears the cookie whatever the backend answers.
// Feature 011: when the account uses two-step sign-in the backend answers 202 with a challenge; its token
// goes into its own __Host- cookie (5 minutes) and the browser receives only { twoFactorRequired: true }.

export const dynamic = "force-dynamic";

const SignInBody = z.object({ email: z.string().max(254), password: z.string().max(128) }).strict();
const PASS_THROUGH = new Set([401, 403, 422, 429, 503]);

function failure(error: unknown, requestId: string): Response {
  if (error instanceof ApiError && error.kind === "timeout") return errorJson(504, "timeout", "The service took too long to answer.", requestId);
  if (error instanceof ApiError && error.kind === "unconfigured") {
    return errorJson(503, "service_unavailable", "The Command Centre is temporarily unavailable.", requestId);
  }
  if (error instanceof ApiError) return errorJson(502, "upstream_error", "The service did not answer.", requestId);
  throw error;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  const read = await readJsonBody(request, 1024);
  if (!read.ok) return errorJson(read.status, read.code, read.message, requestId);
  const body = SignInBody.safeParse(read.value);
  if (!body.success) return errorJson(422, "validation_error", "Enter your email and password.", requestId);

  let result;
  try {
    result = await callAdminBackend({
      method: "POST",
      path: "/admin/auth/sign-in",
      template: "/admin/auth/sign-in",
      body: body.data,
      // A token the browser still holds is passed on so the backend ends it (no session fixation).
      sessionToken: cookieValue(request, SESSION_COOKIE),
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: 10000,
    });
  } catch (error) {
    return failure(error, requestId);
  }

  if (result.status === 200) {
    const issued = SessionIssuedSchema.safeParse(result.body);
    if (!issued.success) return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
    return noStoreJson(issued.data.viewer, 200, { "set-cookie": sessionCookie(issued.data.token) });
  }
  if (result.status === 202) {
    const challenge = TwoFactorChallengeSchema.safeParse(result.body);
    if (!challenge.success) return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
    return noStoreJson({ twoFactorRequired: true }, 202, { "set-cookie": challengeCookie(challenge.data.challengeToken) });
  }
  if (!PASS_THROUGH.has(result.status) || result.body === null) {
    return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
  }
  const headers: Record<string, string> = {};
  if (result.retryAfter) headers["retry-after"] = result.retryAfter;
  return noStoreJson(result.body, result.status, headers);
}

export async function DELETE(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    try {
      await callAdminBackend({
        method: "POST",
        path: "/admin/auth/sign-out",
        template: "/admin/auth/sign-out",
        sessionToken: token,
        csrfToken: request.headers.get("x-csrf-token") ?? undefined,
        clientIp: clientIpFrom(request.headers),
        requestId,
        timeoutMs: 5000,
      });
    } catch {
      // The browser is signed out either way; an unreachable backend must not trap the session.
    }
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store", "set-cookie": clearedSessionCookie() } });
}
