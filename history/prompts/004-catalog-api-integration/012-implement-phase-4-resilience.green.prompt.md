---
id: 012
title: Implement Phase 4 resilience
stage: green
date: 2026-10-04
surface: agent
model: claude-sonnet-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.implement
labels: ["us2","resilience","offline","last-good","fallback-identity","visual-baseline"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - frontend/src/lib/content.ts (getSiteConfig: API, then CLINIC_FALLBACK_JSON, then bundled sample)
 - frontend/src/app/ (doctors, departments, lab-tests, health-packages pages pass the phone to DataUnavailable)
 - frontend/src/components/ (DepartmentSections, DepartmentGrid, FeaturedDoctors)
 - frontend/tests/e2e/stateful/ (resilience.spec.ts, partial-cold.spec.ts)
 - frontend/tests/e2e/offline/ (site.spec.ts, unset.spec.ts, fallback.ts)
 - frontend/tests/e2e/global-setup.ts, frontend/playwright.config.ts, frontend/playwright.offline.config.ts
 - frontend/tests/unit/ (no-api-url-in-client.test.ts, helpers/client-bundle-scan.ts, api-cached.test.ts recovery case)
 - frontend/tests/e2e/visual-baseline.spec.ts (fixed clock) and 32 regenerated snapshots
 - specs/004-catalog-api-integration/tasks.md, results.md
tests:
 - npm run typecheck (pass)
 - npm run lint (pass)
 - npm test (586 passed, was 583)
 - npm run test:e2e (1015 passed, 11 skipped; visual baseline 62/62)
 - npm run test:e2e:stateful (9/9)
 - npm run test:e2e:offline (248 passed, 2 skipped fixme)
 - builds with the API refused (50 s) and unset (14 s) both succeed
---

## Prompt

Feature 004 (specs/004-catalog-api-integration). Phases 1-3 are done. Do ONLY Phase 4 (US2 resilience, T048-T057): API down, slow, erroring and unreachable at build time; keep last good data; emergency number always visible; wire the DataUnavailable phone link (T054). Run all tests including test:e2e:offline, commit, push, then STOP with a short summary.

(Follow-up turns: stop and kill background processes and show git status and task state without committing; then make a local WIP commit, do T056, run the remaining checks one at a time with a 15 minute / network stop rule, and squash into one Phase 4 commit before pushing.)

## Response snapshot

Completed T048-T057. Resilience, partial-cold and recovery specs, offline dead-API and unset specs, client-bundle scan, phone link on every DataUnavailable, clinic identity fallback chain. Both API-less builds succeed. All suites green. A time-dependent label made the Phase 3 visual baseline non-deterministic; the baseline spec now fixes the browser clock and 32 doctor-page snapshots were regenerated.

## Outcome

- Impact: the site renders, with the emergency number, whether the API is down, slow, erroring, malformed, unreachable at build time or not configured; warm pages keep last good data.
- Tests: all suites green; one offline spec case (neutral identity) is test.fixme until Phase 5.
- Files: see list above.
- Next prompts: Phase 5 (US3): identity and rules from data, neutral identity, honesty constants.
- Reflection: sleep and font-fetch hiccups on this machine inflated two runs; a cap and a retry rule kept them from hiding real failures.

## Evaluation notes (flywheel)

- Failure modes observed: my offline spec assumed the mobile nav is always in the DOM; stateful specs leaked cached data between tests; the baseline depended on wall-clock time.
- Graders run and results (PASS/FAIL): PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): none
