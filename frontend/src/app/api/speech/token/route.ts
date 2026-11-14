import * as z from "zod";

import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";
import { getVoiceProvider } from "@/lib/demo";

// Feature 013: a short-lived token for the premium voice provider. OFF (404) unless VOICE_PROVIDER=azure. The API holds
// the provider key and issues the token (rate-limited per visitor); this route only adds the proxy secret and passes the
// token back. The key itself never reaches the browser, and the token is never logged.

export const dynamic = "force-dynamic";

const Token = z.object({ token: z.string().min(10), region: z.string().min(2).max(40), expiresInSeconds: z.number().int().positive() });

/** CSRF guard (005 pattern): the browser sends Origin on every POST, and it must be this site. */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("origin") !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (getVoiceProvider() !== "azure") return errorJson(404, "not_found", "Not found.", requestId);
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  try {
    const result = await callBooking({ method: "POST", path: "/speech/token", body: {}, clientIp: clientIpFrom(request.headers), requestId, timeoutMs: 6000 });
    const token = result.status === 200 ? Token.safeParse(result.body) : null;
    if (token?.success) return noStoreJson(token.data, 200);
    const status = result.status === 429 ? 429 : 503;
    return errorJson(status, status === 429 ? "rate_limited" : "service_unavailable", "The premium voice is not available right now.", requestId);
  } catch (error) {
    if (error instanceof ApiError) return errorJson(503, "service_unavailable", "The premium voice is not available right now.", requestId);
    throw error;
  }
}
