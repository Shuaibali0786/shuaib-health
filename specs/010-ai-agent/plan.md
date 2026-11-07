# Implementation Plan: AI Agent v1

**Branch**: `010-ai-agent` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md) | **ADR**: [ADR-0013](../../history/adr/0013-ai-agent-provider-interface-and-local-engine.md)

## Summary
A provider-agnostic agent interface with one free provider: a deterministic local answer engine that runs in the browser over a knowledge pack of the site's own public data. A lazy-loaded luxury chat widget, client-side throttle, flag `ASSISTANT_ENABLED` (default off).

## Constitution Check
| Principle | Status |
|---|---|
| I Honesty | "Portfolio demo — not medical advice" in the widget; replies only from data; honest "I don't know" |
| II Privacy | No personal data asked/stored/sent; no logs; memory only |
| III Server truth | Prices/hours come from the same server data the pages use; booking still through the booking API |
| IV API-first / X Phase 5 | v1 has no tool calling; the later real-AI provider will call the public APIs through the backend (slot documented) |
| V Resilience | Pack built with the existing fallbacks; if data is missing the engine says so |
| VI Security | No keys in the browser; remote provider must be server-side |
| VIII Performance | Widget code split with `next/dynamic` on first open; pack fetched only then |

## Design
```
frontend/src/agent/types.ts            # AgentProvider, AgentRequest, AgentReply, KnowledgePack
frontend/src/agent/normalize.ts        # lowercase, strip punctuation, synonyms (incl. Roman Urdu words)
frontend/src/agent/localEngine.ts      # intents + scoring + composing replies (pure)
frontend/src/agent/productGuide.ts     # product-guide topics (static)
frontend/src/agent/registry.ts         # providers: { local }; getProvider(); REMOTE SLOT comment
frontend/src/agent/throttle.ts         # 8/min, 60/session (pure, injectable clock)
frontend/src/agent/knowledge.ts        # server-only: build KnowledgePack from cached loaders
frontend/src/components/agent/AssistantLauncher.tsx  # button; lazy-imports the panel
frontend/src/components/agent/AssistantPanel.tsx     # dialog UI
(no route: the pack is passed from the layout as a prop; see analysis A1)
frontend/src/lib/demo.ts               # + isAssistantEnabled() (build-time env, default off)
(site)/layout.tsx                       # renders <AssistantLauncher> only when enabled
```
Knowledge delivery (as built): `loadKnowledgePack()` runs in the site layout only when the flag is on and passes the pack to the widget as a prop. No new route and no new `fetch()` (guard tests). Public data only; a unit test asserts the field allow-list.

## Decisions → ADR-0013
Browser-side deterministic engine now, provider interface for a server-side LLM later; client throttle now, Postgres rate limit required for any server provider.

## Risks
- Matching quality: mitigated by a 40-question test set and honest fallback.
- Bundle: widget must not enter the first-load JS of public pages (check build diagnostics).
