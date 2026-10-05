import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";
import { DoctorSlotsSchema, ErrorResponseSchema } from "@/lib/booking/schemas";

// Same-origin proxy for the slots of one doctor. It adds transport headers only; the backend decides
// what is available. See specs/005-appointment-booking/contracts/website-booking.md section 1.

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PASS_THROUGH = new Set([404, 422, 429, 503]);
const TIMEOUT_MS = 5000;

function backendQuery(params: URLSearchParams): string {
  const out = new URLSearchParams();
  const from = params.get("from");
  const days = params.get("days");
  if (from !== null && DATE.test(from)) out.set("from", from);
  if (days !== null && /^\d{1,2}$/.test(days) && Number(days) >= 1 && Number(days) <= 60) out.set("days", days);
  const query = out.toString();
  return query ? `?${query}` : "";
}

export async function GET(request: Request, { params }: { params: Promise<{ doctorSlug: string }> }): Promise<Response> {
  const requestId = crypto.randomUUID();
  const { doctorSlug } = await params;
  if (!SLUG.test(doctorSlug) || doctorSlug.length > 80) {
    return errorJson(404, "not_found", "Doctor not found.", requestId);
  }

  let result;
  try {
    result = await callBooking({
      method: "GET",
      path: `/doctors/${doctorSlug}/slots${backendQuery(new URL(request.url).searchParams)}`,
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return errorJson(503, "service_unavailable", "Online booking is temporarily unavailable.", requestId);
    }
    throw error;
  }

  if (result.status === 200) {
    const parsed = DoctorSlotsSchema.safeParse(result.body);
    if (parsed.success) return noStoreJson(parsed.data, 200);
    return errorJson(502, "bad_gateway", "Unexpected answer from the booking service.", requestId);
  }

  if (PASS_THROUGH.has(result.status)) {
    const parsed = ErrorResponseSchema.safeParse(result.body);
    if (parsed.success) {
      return noStoreJson(parsed.data, result.status, result.retryAfter ? { "retry-after": result.retryAfter } : {});
    }
  }
  return errorJson(502, "bad_gateway", "Unexpected answer from the booking service.", requestId);
}
