import * as z from "zod";

import { loadKnowledgePack } from "@/agent/knowledge";
import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom } from "@/lib/booking/backend";
import { errorJson, noStoreJson } from "@/lib/booking/respond";
import { getAssistantProvider, isAssistantEnabled } from "@/lib/demo";

// The optional AI provider's website route (Feature 010 v1.1). OFF unless the assistant is on AND
// ASSISTANT_PROVIDER=claude: otherwise 404, and the chat keeps its free built-in engine. It adds the public
// knowledge pack and the proxy secret on the server and passes only the answer text back. Never logs the
// question.

export const dynamic = "force-dynamic";

const Body = z.object({ question: z.string().trim().min(1).max(300) }).strict();
const Answer = z.object({ text: z.string().min(1).max(2000) });
/** CSRF guard (005 pattern): the browser sends Origin on every POST, and it must be this site. */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("origin") !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

const BUSY = "The assistant is busy; using the built-in answers.";

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!isAssistantEnabled() || getAssistantProvider() !== "claude") return errorJson(404, "not_found", "Not found.", requestId);
  if (!isSameOrigin(request)) return errorJson(403, "forbidden", "Forbidden.", requestId);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return errorJson(415, "unsupported_media_type", "Send the request as JSON.", requestId);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 1024) return errorJson(413, "payload_too_large", "The request is too large.", requestId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return errorJson(422, "validation_error", "The request is not valid JSON.", requestId);
  }
  const body = Body.safeParse(parsed);
  if (!body.success) return errorJson(422, "validation_error", "Ask a question of up to 300 characters.", requestId);

  try {
    const result = await callBooking({
      method: "POST",
      path: "/assistant/answer",
      body: { question: body.data.question, pack: await loadKnowledgePack() },
      clientIp: clientIpFrom(request.headers),
      requestId,
      timeoutMs: 10000,
    });
    const answer = result.status === 200 ? Answer.safeParse(result.body) : null;
    if (answer?.success) return noStoreJson({ text: answer.data.text }, 200);
    const status = result.status === 429 ? 429 : 503;
    return errorJson(status, status === 429 ? "rate_limited" : "service_unavailable", BUSY, requestId);
  } catch (error) {
    if (error instanceof ApiError) return errorJson(503, "service_unavailable", BUSY, requestId);
    throw error;
  }
}
