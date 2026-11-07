// The optional AI provider's browser side (Feature 010 v1.1, OFF by default). The free engine answers
// first: greetings, emergencies, symptoms and everything it knows stay deterministic and free. Only an
// "unknown" patient question is sent to this site's /api/assistant route; any failure there (off, limits,
// monthly budget, network) returns the free engine's own friendly answer, so the chat never breaks.

import { answer as localAnswer } from "./localEngine";
import type { AgentProvider, AgentReply, KnowledgePack } from "./types";

const TIMEOUT_MS = 12_000;

async function askServer(question: string): Promise<string | null> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const text = (body as { text?: unknown } | null)?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export function createRemoteProvider(pack: KnowledgePack): AgentProvider {
  return {
    id: "claude",
    async answer(request): Promise<AgentReply> {
      const local = localAnswer(request, pack);
      if (request.mode !== "patient" || local.intent !== "unknown") return local;
      const text = await askServer(request.question.trim());
      return text ? { intent: "ai", text, links: [{ label: "Book an appointment", href: "/book-appointment" }] } : local;
    },
  };
}
