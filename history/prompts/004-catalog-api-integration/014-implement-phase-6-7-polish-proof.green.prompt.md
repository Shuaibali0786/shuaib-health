---
id: 014
title: Implement Phase 6 and 7 polish proof
stage: green
date: 2026-10-04
surface: agent
model: claude-sonnet-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.implement
labels: ["us4","guard-tests","json-ld","lighthouse","docs","gitleaks","npm-audit","final-gate"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - frontend/tests/unit/server-only-boundary.test.ts, single-fetch.test.ts, json-ld.test.tsx, helpers/src-files.ts (new)
 - frontend/README.md, README.md, backend/README.md
 - specs/004-catalog-api-integration/results.md, tasks.md
tests:
 - npm run typecheck (pass), npm run lint (pass)
 - npm test (626 passed, was 619)
 - npm run test:e2e (1023 passed, 11 skipped)
 - npm run test:e2e:stateful (11/11), npm run test:e2e:offline (252 passed)
 - npm run build (pass); gitleaks (no leaks); drift demo fails as intended
---

## Prompt

Feature 004 (specs/004-catalog-api-integration). Phases 1-5 are done. Do Phase 6 (T070-T073) and then Phase 7 (T074-T080). Also: 1) make sure the JSON-LD component escapes "<" so data can never break out of the script tag, with a unit test; 2) run npm audit and fix high issues if a safe non-breaking fix exists, otherwise list them. Run all checks one at a time; if any step hangs over 15 minutes or fails on network/Google Fonts, STOP and tell me. Commit, push, then STOP with a short final summary of Feature 004.

## Response

Added the server-only boundary, single-fetch and JSON-LD escaping tests (JsonLd already escaped "<"). Ran the full suite with the backend stopped, demonstrated contract drift detection, measured Lighthouse (no regression, LCP lower), updated the three READMEs, installed gitleaks and found no leaks, and recorded everything in results.md. npm audit: 5 high, dev-only lint chain, no non-breaking fix, left as is. T075 (real-backend white-label demo and 5-minute recovery) was not run because it edits a shared dev database.
