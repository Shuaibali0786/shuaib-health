import * as z from "zod";

import { loadKnowledgePack } from "@/agent/knowledge";
import { errorJson, noStoreJson } from "@/lib/booking/respond";
import { getGeminiSettings, getOpenRouterSettings, getVoiceBrain } from "@/lib/demo";
import { askGemini } from "@/lib/voiceBrainGemini";
import { askOpenRouter } from "@/lib/voiceBrainOpenRouter";

// Feature 013: the optional AI brain's website route. OFF (404) unless VOICE_BRAIN=openrouter (and OPENROUTER_API_KEY) or
// VOICE_BRAIN=gemini (and GEMINI_API_KEY) is set on this (website) project. It understands one turn (a closed list of actions over the public catalog) and
// never books. Never logs the patient's words. Any failure is a 503, and the browser keeps the rule brain's reply.

export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().trim().min(1).max(300), lang: z.enum(["en", "roman"]) }).strict();

/** CSRF guard (005 pattern): the browser sends Origin on every POST, and it must be this site. */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("origin") !== new URL(request.url).origin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const brain = getVoiceBrain();
  const gemini = brain === "gemini" ? getGeminiSettings() : null;
  const openrouter = brain === "openrouter" ? getOpenRouterSettings() : null;
  if (!gemini && !openrouter) return errorJson(404, "not_found", "Not found.", requestId);
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
  if (!body.success) return errorJson(422, "validation_error", "Send up to 300 characters.", requestId);
  const pack = await loadKnowledgePack();
  const decision = openrouter ? await askOpenRouter(body.data.text, body.data.lang, pack, openrouter) : await askGemini(body.data.text, body.data.lang, pack, gemini);
  if (!decision) return errorJson(503, "service_unavailable", "The AI brain is not available; using the built-in rules.", requestId);
  return noStoreJson(decision, 200);
}
