// Which provider answers (Feature 010, ADR-0013). v1 has only the free local engine.
//
// REMOTE SLOT (later, needs owner approval and a key): add `createRemoteProvider()` that POSTs
// `{ mode, question }` to a backend endpoint behind the existing BFF. The backend calls the AI model with the
// same knowledge pack as grounding, applies the Postgres rate limiter (ADR-0006), keeps the key in env vars,
// and never receives personal data. The widget does not change: it only calls `getProvider(...).answer()`.
// See docs/runbooks/ai-provider.md.

import { createLocalProvider } from "./localEngine";
import type { AgentProvider, KnowledgePack } from "./types";

export type ProviderId = "local";

export function getProvider(pack: KnowledgePack, id: ProviderId = "local"): AgentProvider {
  switch (id) {
    case "local":
      return createLocalProvider(pack);
  }
}
