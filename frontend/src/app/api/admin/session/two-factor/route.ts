import * as z from "zod";

import { CHALLENGE_COOKIE, SESSION_COOKIE } from "@/admin/lib/cookie";
import { SessionIssuedSchema } from "@/admin/lib/schemas";
import { callAdminBackend } from "@/admin/lib/server";
import { clearedChallengeCookie, cookieValue, isSameOrigin, readJsonBody, sessionCookie } from "@/admin/lib/sessionRoute";
import { ApiError } from "@/lib/api/http";
import { clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";

// The second sign-in step (Feature 011, specs/011-admin-two-factor/contracts/two-factor-api.md). The
// challenge token never reaches the browser: it is read from the __Host- challenge cookie set by the
// sign-in route. On success the session cookie is set and the challenge cookie is cleared; the browser
// receives the `viewer` alone, exactly as after a password-only sign-in.

export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ code: z.string().regex(/^[0-9 ]{6,7}$/) }).strict(),
  z.object({ backupCode: z.string().regex(/^[A-Za-z0-9 -]{10,13}$/) }).strict(),
]);
const PASS_THROUGH = new Set([401, 403, 422, 429, 503]);
// These answers end the step, so the cookie goes too and the person starts again with the password.
const ENDS_STEP = new Set(["challenge_expired", "account_locked"]);

function withCookies(response: Response, ...cookies: string[]): Response {
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  const read = await readJsonBody(request, 512);
  if (!read.ok) return errorJson(read.status, read.code, read.message, requestId);
  const body = Body.safeParse(read.value);
  if (!body.success) return errorJson(422, "validation_error", "Enter the 6-digit code or a backup code.", requestId);

  const challengeToken = cookieValue(request, CHALLENGE_COOKIE);
  if (!challengeToken) {
    return errorJson(401, "challenge_expired", "This sign-in step has ended. Please sign in again.", requestId);
  }

  let result;
  try {
    result = await callAdminBackend({
      method: "POST",
      path: "/admin/auth/sign-in/two-factor",
      template: "/admin/auth/sign-in/two-factor",
      body: { challengeToken, ...body.data },
      sessionToken: cookieValue(request, SESSION_COOKIE),
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: 10000,
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "timeout") return errorJson(504, "timeout", "The service took too long to answer.", requestId);
    if (error instanceof ApiError && error.kind === "unconfigured") {
      return errorJson(503, "service_unavailable", "The Command Centre is temporarily unavailable.", requestId);
    }
    if (error instanceof ApiError) return errorJson(502, "upstream_error", "The service did not answer.", requestId);
    throw error;
  }

  if (result.status === 200) {
    const issued = SessionIssuedSchema.safeParse(result.body);
    if (!issued.success) return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
    return withCookies(noStoreJson(issued.data.viewer, 200), sessionCookie(issued.data.token), clearedChallengeCookie());
  }
  if (!PASS_THROUGH.has(result.status) || result.body === null) {
    return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
  }
  const headers: Record<string, string> = {};
  if (result.retryAfter) headers["retry-after"] = result.retryAfter;
  const response = noStoreJson(result.body, result.status, headers);
  const code = (result.body as { error?: { code?: unknown } }).error?.code;
  return typeof code === "string" && ENDS_STEP.has(code) ? withCookies(response, clearedChallengeCookie()) : response;
}
