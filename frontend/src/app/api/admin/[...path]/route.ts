import { SESSION_COOKIE } from "@/admin/lib/cookie";
import { callAdminBackend } from "@/admin/lib/server";
import { clearedSessionCookie, cookieValue, isSameOrigin, withoutToken } from "@/admin/lib/sessionRoute";
import { matchAdminRoute, type AdminMethod } from "@/admin/lib/bffRoutes";
import { ApiError } from "@/lib/api/http";
import { clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";

// The Command Centre's same-origin proxy: the browser talks to this route only, never to the backend.
// It matches the request against the allow-list (anything else is a 404 before any backend call),
// guards it, adds the transport headers and the session token from the cookie, and passes the backend's
// answer through. It never rewrites a business outcome, never returns a session token and never logs a
// body. See specs/006-clinic-command-centre/contracts/website-admin.md §3.

export const dynamic = "force-dynamic";

const PASS_THROUGH = new Set([200, 201, 204, 401, 403, 404, 409, 422, 429, 503]);

async function handle(request: Request, ctx: RouteContext<"/api/admin/[...path]">): Promise<Response> {
  const requestId = crypto.randomUUID();
  const method = request.method as AdminMethod;
  const { path } = await ctx.params;
  const url = new URL(request.url);

  const matched = matchAdminRoute(method, path, url.searchParams);
  if (!matched) return errorJson(404, "not_found", "Not found.", requestId);
  if (matched.invalid.length > 0) {
    return noStoreJson(
      {
        error: {
          code: "validation_error",
          message: "Some request parameters are invalid.",
          requestId,
          details: matched.invalid.map((field) => ({ field, issue: "is invalid" })),
        },
      },
      422,
    );
  }

  let body: unknown;
  if (method !== "GET") {
    if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
    const limit = matched.route.bodyLimit;
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > limit) return errorJson(413, "payload_too_large", "The request is too large.", requestId);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > limit) {
      return errorJson(413, "payload_too_large", "The request is too large.", requestId);
    }
    if (limit > 0 && text !== "") {
      if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
        return errorJson(415, "unsupported_media_type", "Send the request as JSON.", requestId);
      }
      try {
        body = JSON.parse(text);
      } catch {
        return errorJson(422, "validation_error", "The request is not valid JSON.", requestId);
      }
    }
  }

  const sessionToken = cookieValue(request, SESSION_COOKIE);
  if (!sessionToken) return errorJson(401, "not_signed_in", "Please sign in.", requestId);

  let result;
  try {
    result = await callAdminBackend({
      method,
      path: matched.backendPath as `/${string}`,
      template: matched.template,
      body,
      sessionToken,
      csrfToken: request.headers.get("x-csrf-token") ?? undefined,
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: matched.route.timeoutMs,
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "timeout") {
      return errorJson(504, "timeout", "The service took too long to answer.", requestId);
    }
    if (error instanceof ApiError && error.kind === "unconfigured") {
      return errorJson(503, "service_unavailable", "The Command Centre is temporarily unavailable.", requestId);
    }
    if (error instanceof ApiError) return errorJson(502, "upstream_error", "The service did not answer.", requestId);
    throw error;
  }

  if (!PASS_THROUGH.has(result.status)) {
    return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId);
  }

  const headers: Record<string, string> = {};
  if (result.retryAfter) headers["retry-after"] = result.retryAfter;
  if (result.status === 401) headers["set-cookie"] = clearedSessionCookie();
  if (result.status === 204) return new Response(null, { status: 204, headers: { "cache-control": "no-store", ...headers } });
  if (result.body === null) return errorJson(502, "upstream_error", "Unexpected answer from the service.", requestId, headers);
  return noStoreJson(withoutToken(result.body), result.status, headers);
}

export { handle as GET, handle as POST, handle as PATCH };
