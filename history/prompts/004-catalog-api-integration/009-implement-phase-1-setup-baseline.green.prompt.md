---
id: 009
title: Implement Phase 1 setup and baseline
stage: green
date: 2026-10-03
surface: agent
model: claude-sonnet-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.implement
labels: ["setup","baseline","visual-baseline","lighthouse","openapi-typescript"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - frontend/tests/e2e/visual-baseline.spec.ts
 - frontend/tests/e2e/visual-baseline.spec.ts-snapshots/ (62 PNGs)
 - frontend/tests/unit/helpers/server-only-stub.ts
 - frontend/vitest.config.mts
 - frontend/package.json
 - frontend/package-lock.json
 - frontend/.env.example
 - frontend/.gitignore
 - specs/004-catalog-api-integration/results.md
 - specs/004-catalog-api-integration/tasks.md
tests:
 - npm run typecheck (pass)
 - npm run lint (pass)
 - npm test (475 passed)
 - npm run test:e2e (953 passed, 11 skipped)
 - visual-baseline (62/62, stable on re-run)
---

## Prompt

Feature 004 (specs/004-catalog-api-integration). Do ONLY Phase 1 (Setup & baseline, T001-T006). Run the tests, commit, then STOP and give me a short summary.

## Response snapshot

Completed T001-T006: recorded baseline test counts/durations and Lighthouse medians in results.md, added the 62-snapshot visual baseline, installed openapi-typescript 7.13.0 (with --legacy-peer-deps because it peers on TypeScript ^5), added the server-only vitest alias and stub, five npm scripts, env vars and the .next-* ignore. Found that `npm run api:types` crashes on the Feature 003 contract (headers: { $ref } at openapi.yaml line 33); left it for T009.

## Outcome

- ✅ Impact: Phase 1 done; baselines committed for later "no visual change" and performance comparisons.
- 🧪 Tests: all suites green after changes (475 unit, 953 e2e).
- 📁 Files: see list above.
- 🔁 Next prompts: Phase 2 (T007+); decide how to handle the invalid contract header ref before T009.
- 🧠 Reflection: tasks.md names vitest.config.ts but the file is vitest.config.mts.

## Evaluation notes (flywheel)

- Failure modes observed: npm ERESOLVE on TypeScript 6 peer; api:types crash on contract.
- Graders run and results (PASS/FAIL): PASS for all suites.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): fix openapi.yaml header ref in Feature 003 contract, then regenerate.
