---
id: 001
title: AI agent v1 overnight build
stage: green
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 010-ai-agent
branch: 010-ai-agent
user: Shuaibali0786
command: unattended overnight run (Phase C, feature c)
labels: ["ai-agent","chat","feature-flag","overnight"]
links:
  spec: specs/010-ai-agent/spec.md
  ticket: null
  adr: history/adr/0013-ai-agent-provider-interface-and-local-engine.md
  pr: null
files:
 - specs/010-ai-agent/*
 - history/adr/0013-ai-agent-provider-interface-and-local-engine.md
 - docs/runbooks/ai-provider.md
 - frontend/src/agent/*
 - frontend/src/components/agent/*
 - frontend/src/lib/demo.ts
 - frontend/src/app/(site)/layout.tsx
 - frontend/.env.example
 - frontend/tests/unit/agent-engine.test.ts
 - frontend/tests/unit/agent-widget.test.tsx
 - frontend/tests/e2e/assistant.spec.ts
tests:
 - Vitest full 1466 passed
 - Playwright assistant+home with ASSISTANT_ENABLED=true 28 passed
---

## Prompt

Feature (c) v1 with NO paid AI: a provider-agnostic agent interface plus a free built-in answer engine that matches questions to the project's own data and FAQs. A luxury chat widget, mobile-friendly, rate-limited, behind a feature flag that is OFF by default. Leave a clean slot to plug in a real AI provider later. List 2-3 AI provider options with monthly cost estimates in the questions file. Open its DRAFT PR. (Full overnight prompt in history/prompts/general/024-overnight-phase-c-run.general.prompt.md.)

## Response snapshot

AgentProvider interface + registry with a local deterministic engine (intents, Roman Urdu synonyms, entity scoring over doctors/departments/tests/packages/FAQ, safety replies) and a product-guide mode on the demo. Lazy chat widget (navy/gold, aria-live log, Esc + focus return, chips, plain links), client throttle 8/min and 60/session, ASSISTANT_ENABLED default off, knowledge pack passed as a prop (no new fetch/route). Runbook for a future server-side provider.

## Outcome

- ✅ Impact: free assistant ready behind a flag
- 🧪 Tests: Vitest 1466 pass; flag-on e2e 28 pass
- 📁 Files: see list
- 🔁 Next prompts: choose an AI provider and budget; Lighthouse with flag on
- 🧠 Reflection: guard tests shaped the design (no new fetch, env reads in one file)

## Evaluation notes (flywheel)

- Failure modes observed: jsdom lacks element.scrollTo; focus return after unmount needed an effect
- Graders run and results (PASS/FAIL): typecheck PASS, lint PASS, vitest PASS, e2e PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
