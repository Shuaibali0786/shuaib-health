// Which provider answers (Feature 010, ADR-0013; v1.1).
//
// - "local" (default): the free built-in engine, in the browser, no network call.
// - "claude" (OFF unless ASSISTANT_PROVIDER=claude at build time): the free engine answers first; only a
//   question it cannot answer is sent to /api/assistant, which asks the backend's Claude Haiku provider
//   (grounded only in the clinic's public data, rate-limited, with a hard monthly cost cap). Any refusal
//   or failure there gives the free engine's answer, so the chat never breaks. See docs/runbooks/ai-provider.md.

import { createLocalProvider } from "./localEngine";
import { createRemoteProvider } from "./remoteProvider";
import type { AgentProvider, KnowledgePack } from "./types";

export type ProviderId = "local" | "claude";

export function getProvider(pack: KnowledgePack, id: ProviderId = "local"): AgentProvider {
  switch (id) {
    case "local":
      return createLocalProvider(pack);
    case "claude":
      return createRemoteProvider(pack);
  }
}
