import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";
import { AppointmentViewSchema, BookingConflictSchema } from "@/lib/booking/schemas";

// Same-origin proxy for booking. It guards the request, adds transport headers and passes the
// backend's answer through; it never rewrites a business outcome and never logs a body.
// See specs/005-appointment-booking/contracts/website-booking.md section 1.

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const TIMEOUT_MS = 15_000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PASS_THROUGH = new Set([400, 403, 409, 422, 429, 503]);

/** CSRF guard: the browser sends `Origin` on every POST, so it must be this site, and never cross-site. */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("origin") !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return errorJson(415, "unsupported_media_type", "Send the booking as JSON.", requestId);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return errorJson(413, "payload_too_large", "The request is too large.", requestId);

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return errorJson(413, "payload_too_large", "The request is too large.", requestId);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return noStoreJson(
      { error: { code: "validation_error", message: "The request is not valid JSON.", requestId, details: [{ field: "request", issue: "is not valid JSON" }] } },
      422,
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!UUID_V4.test(idempotencyKey)) {
    return noStoreJson(
      { error: { code: "validation_error", message: "Some request parameters are invalid.", requestId, details: [{ field: "idempotencyKey", issue: "must be a UUID v4" }] } },
      422,
    );
  }

  let result;
  try {
    result = await callBooking({
      method: "POST",
      path: "/appointments",
      body,
      idempotencyKey,
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === "timeout") {
      return errorJson(504, "timeout", "The booking service took too long to answer.", requestId);
    }
    if (error instanceof ApiError) {
      return errorJson(503, "service_unavailable", "Online booking is temporarily unavailable.", requestId);
    }
    throw error;
  }

  if (result.status === 201) {
    const parsed = AppointmentViewSchema.safeParse(result.body);
    if (parsed.success) return noStoreJson(parsed.data, 201);
  } else if (PASS_THROUGH.has(result.status)) {
    const parsed = BookingConflictSchema.safeParse(result.body);
    if (parsed.success) {
      return noStoreJson(parsed.data, result.status, result.retryAfter ? { "retry-after": result.retryAfter } : {});
    }
  }
  return errorJson(502, "bad_gateway", "Unexpected answer from the booking service.", requestId);
}
