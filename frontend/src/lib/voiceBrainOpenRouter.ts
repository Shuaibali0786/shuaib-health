// Server only. The optional AI brain for the voice receptionist through OpenRouter (Feature 013, VOICE_BRAIN=openrouter).
//
// Same job and same rules as the Gemini brain: one request per turn the rule brain could not understand, our PUBLIC
// catalog only, exactly one of five tools, every answer validated against the catalog here and again in the browser,
// never books. OpenRouter speaks the OpenAI chat-completions format.
//
// FREE MODELS ONLY: a model id must end in ":free" (anything else in OPENROUTER_MODEL is dropped), and every request also
// carries `provider.max_price = 0`, so even a mistake cannot reach a paid model. The key stays on the server.
// A failure, a 429 or a timeout tries the next free model, then silently leaves the rule brain's reply in place.

import "server-only";

import type { KnowledgePack } from "@/agent/types";
import { BrainDecisionSchema, type BrainDecision } from "@/voice/brain";

import { parseFreeModels } from "./openrouterModels";
import { systemPrompt, tools, validInCatalog } from "./voiceBrainGemini";

export { parseFreeModels };

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** The whole call, all models together, stays under the browser's own 6 s limit. */
const TOTAL_MS = 5500;
/** One model gets at most this long (a model that is rate limited fails at once, so the next one still has time; a slow free model gets the whole budget). */
const PER_MODEL_MS = 5000;

/** Gemini's tool declarations (upper-case JSON schema types) in the OpenAI format. */
function openAiTools(pack: KnowledgePack) {
  const lower = (schema: unknown): unknown => {
    if (Array.isArray(schema)) return schema.map(lower);
    if (schema && typeof schema === "object") {
      return Object.fromEntries(Object.entries(schema as Record<string, unknown>).map(([k, v]) => [k, k === "type" && typeof v === "string" ? v.toLowerCase() : lower(v)]));
    }
    return schema;
  };
  return tools(pack)[0]?.functionDeclarations.map((f) => ({ type: "function", function: { name: f.name, description: f.description, parameters: lower(f.parameters) } })) ?? [];
}

/** What OpenRouter said, safe to log: status and reason only (the key, if echoed, is blanked). Never patient text. */
async function reasonOf(res: Response, key: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: number | string } };
    const text = `${body.error?.code ?? ""} ${body.error?.message ?? ""}`.trim();
    return text.split(key).join("[key]").replace(/sk-or-[\w-]{6,}/g, "[key]").replace(/\s+/g, " ").slice(0, 240);
  } catch {
    return "(no reason given)";
  }
}

const log = (message: string) => console.warn(`[voice-brain] ${message}`);

type Reply = { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> };

/** The model's single tool call as a decision (validated against the catalog), or null. */
function decisionOf(body: Reply, pack: KnowledgePack): BrainDecision | null {
  const call = body.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.name) return null;
  let args: Record<string, unknown> = {};
  try {
    args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
  const parsed = BrainDecisionSchema.safeParse({ action: call.name, ...args });
  return parsed.success && validInCatalog(parsed.data, pack) ? parsed.data : null;
}

/** The brain's choice, validated against the catalog; null when off, failing, or invalid (the rules then answer). */
export async function askOpenRouter(
  text: string,
  lang: "en" | "roman",
  pack: KnowledgePack,
  settings: { key: string; models: string[] } | null,
  fetcher: typeof fetch = fetch,
): Promise<BrainDecision | null> {
  if (!settings?.key) return null;
  const { key } = settings;
  const models = settings.models.filter((m) => m.endsWith(":free")).slice(0, 3);
  const started = Date.now();
  for (const model of models) {
    const left = TOTAL_MS - (Date.now() - started);
    if (left < 600) break;
    try {
      const res = await fetcher(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt(pack) },
            { role: "user", content: `(${lang === "roman" ? "Roman Urdu" : "English"}) ${text.slice(0, 300)}` },
          ],
          tools: openAiTools(pack),
          tool_choice: "required",
          temperature: 0.1,
          max_tokens: 256,
          // Never a paid model: a price ceiling of zero, and no passing the request on to a provider that charges.
          provider: { max_price: { prompt: 0, completion: 0 }, require_parameters: true },
        }),
        signal: AbortSignal.timeout(Math.min(left, PER_MODEL_MS)),
      });
      if (!res.ok) {
        log(`${model} failed: HTTP ${res.status} ${await reasonOf(res, key)}`);
        continue;
      }
      const decision = decisionOf((await res.json()) as Reply, pack);
      if (decision) {
        log(`${model} answered`);
        return decision;
      }
      log(`${model} gave no usable choice`);
    } catch {
      log(`${model} did not answer (network or timeout)`);
    }
  }
  return null;
}
