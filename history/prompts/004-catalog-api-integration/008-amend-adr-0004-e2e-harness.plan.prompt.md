---
id: 008
title: Amend ADR-0004 with e2e harness
stage: plan
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: amend ADR-0004
labels: ["adr", "e2e-design", "caching", "amendment"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - history/adr/0004-catalog-caching-and-resilience-strategy.md
 - CLAUDE.md (BOM-only change, committed on request)
tests:
 - none
---

## Prompt

Amend ADR-0004 with the three-way browser-test split and the test-only refresh override (no new ADR). Also commit the CLAUDE.md change. Then show git status. Do not start implementing.

## Response snapshot

Amended ADR-0004 in place:
- status line marks the amendment;
- cache boundary: test-only `CATALOG_DATA_REVALIDATE_SECONDS` (default and production 300; segment revalidate stays literal);
- time budget: one 3 s signal per resource;
- honesty text from constants;
- test harness: main / stateful (`next dev`, 3 s window, `/__log` proof, cache-guard, cold server) / offline, with `NEXT_DIST_DIR` per server;
- consequences: one dev dependency (no `server-only`), dev-vs-prod coverage gap, two test-only env vars, unverified dual dev servers;
- new alternatives H (single config with mode switches) and I (revalidation endpoint / internal header), both rejected;
- references to the Next source and docs lines.

Committed the ADR amendment and, separately, the CLAUDE.md change (only a UTF-8 BOM added). No implementation started.

## Outcome

- ✅ Impact: ADR-0004 now matches plan Key Decisions 6–7 and tasks
- 🧪 Tests: none
- 📁 Files: ADR-0004, CLAUDE.md
- 🔁 Next prompts: /sp.implement when ready
- 🧠 Reflection: the CLAUDE.md diff was only an encoding BOM; flagged it rather than silently committing it as a content change

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): ADR vs plan consistency — PASS (the open Low "ADR-0004 stale" is resolved)
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
