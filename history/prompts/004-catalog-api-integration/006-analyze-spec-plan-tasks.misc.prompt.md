---
id: 006
title: Analyze spec plan tasks consistency
stage: misc
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.analyze
labels: ["analyze", "consistency", "constitution", "e2e-design"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - none modified (read-only analysis)
tests:
 - none
---

## Prompt

/sp.analyze (no additional input)

## Response snapshot

Read-only analysis of spec.md, plan.md, tasks.md against constitution 1.0.0. 0 CRITICAL, 7 HIGH, 7 MEDIUM, 4 LOW. Key HIGH findings:
- E2E failure-path tests (T048/T060, US1/US3 independent tests) cannot exercise refresh failure or rebrand because data and pages stay fresh for the static 300 s. Fix: make only the unstable_cache revalidate env-configurable (CATALOG_DATA_REVALIDATE_SECONDS, default 300) and test cold routes.
- Global mock mode + fullyParallel + shared Next cache → cross-test interference. Fix: dedicated serial Playwright project(s) with own servers.
- Main Playwright config would run offline-*.spec.ts. Fix: testIgnore.
- Two concurrent `next build` into the same .next in the offline config.
- Constitution I: demo notice and credit sourced from mutable API data, and the neutral identity omits the credit. Fix: pin both to constitution constants or assert them.
MEDIUM: 3 s per call vs per render, server-only runtime dep not in Complexity Tracking, tasks lack constitution phase label, secret scan missing from final gate, Lighthouse not automated, dangling-reference edge untested, US1 "changed name" test unimplemented. Coverage 40/40 requirements (3 only implicit).

## Outcome

- ✅ Impact: Identified test-design flaws that would have produced false passes or flaky e2e before implementation
- 🧪 Tests: none
- 📁 Files: none modified
- 🔁 Next prompts: approve remediation edits to tasks.md/plan.md/data-model.md, then /sp.implement
- 🧠 Reflection: Static route-segment revalidate plus a shared Next cache makes stateful e2e mode-switching tests fundamentally unreliable; those tests need separate servers or an env-tunable data-cache window.

## Evaluation notes (flywheel)

- Failure modes observed: tasks written assuming failure paths reachable in e2e without waiting for staleness
- Graders run and results (PASS/FAIL): constitution alignment — no CRITICAL; 2 HIGH items touch Principle I
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
