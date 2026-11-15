// The optional AI brain's contract and its browser side (Feature 013, VOICE_BRAIN=gemini, OFF by default).
//
// The free rule brain answers first, always. Only a patient turn it could NOT understand is sent to this site's own
// /api/voice/brain route, which asks Google Gemini (free tier, key on the server) to pick ONE action from a closed
// list over our public catalog. The browser checks every slug again against the catalog. The brain never books,
// never sees a phone number or a name it does not need, and any failure (off, no key, limit, timeout) silently
// leaves the rule brain's own reply in place.

import * as z from "zod";

import type { VoiceLang } from "./types";

export const BrainDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suggest_department"), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) }),
  z.object({ action: z.literal("offer_lab_test"), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) }),
  z.object({ action: z.literal("offer_package"), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) }),
  z.object({ action: z.literal("clinic_answer"), text: z.string().trim().min(1).max(400) }),
  z.object({ action: z.literal("ask_problem") }),
]);
export type BrainDecision = z.infer<typeof BrainDecisionSchema>;

/** Asks the brain to understand one turn. Null on any problem (the caller keeps its own reply). */
export type Brain = (text: string, lang: VoiceLang) => Promise<BrainDecision | null>;

const TIMEOUT_MS = 6000;

export const askBrainOverHttp: Brain = async (text, lang) => {
  try {
    const res = await fetch("/api/voice/brain", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ text: text.slice(0, 300), lang }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = BrainDecisionSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
