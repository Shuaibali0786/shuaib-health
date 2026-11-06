# Tasks: AI Agent v1 (010)

## Phase 1 — Setup
- [x] T001 Branch `010-ai-agent` from `main`; spec, plan, tasks, ADR-0013

## Phase 2 — Foundation (engine, pure, test-first)
- [x] T002 [P] `src/agent/types.ts`, `registry.ts` (local only, remote slot documented)
- [x] T003 [P] `normalize.ts` + tests (synonyms, Roman Urdu words, length limits)
- [x] T004 `localEngine.ts` + 40-question test set (`tests/unit/agent-engine.test.ts`), ≥ 90% correct
- [x] T005 [P] `throttle.ts` + tests (8/min rolling, 60/session)
- [x] T006 Safety replies (symptom, emergency) + tests

## Phase 3 — US1 Patient mode (P1)
- [x] T007 `knowledge.ts` (server) passed as a prop from the layout (no new route, see analysis A1) + allow-list test
- [x] T008 `isAssistantEnabled()` flag (default off) + test
- [x] T009 Widget: launcher (lazy), panel, messages, chips, links, aria-live, Esc/focus return
- [x] T010 Mount in `(site)/layout.tsx` only when enabled

## Phase 4 — US2 Product guide (P2)
- [x] T011 `productGuide.ts` topics; tab shown only with demo on; tests

## Phase 5 — US3 Provider slot (P3)
- [x] T012 Registry docs + `docs/runbooks/ai-provider.md` (how to add a provider safely)

## Phase 6 — Verify
- [x] T013 Unit tests for widget (open, ask, answer, throttle message, Esc)
- [x] T014 Playwright with flag on (local run; CI runs the flag-off check)
- [x] T015 typecheck, lint, Vitest full; results.md; Draft PR; no merge
