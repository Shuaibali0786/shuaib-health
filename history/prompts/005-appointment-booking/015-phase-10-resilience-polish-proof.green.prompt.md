---
id: 015
title: Phase 10 resilience polish and proof
stage: green
date: 2026-10-05
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["booking", "polish", "mypy", "lighthouse", "cls", "gitleaks", "final-gate"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/components/booking/ConfirmationCard.tsx
 - frontend/src/app/book-appointment/confirmed/[reference]/page.tsx
 - frontend/src/app/book-appointment/page.tsx
 - frontend/tests/e2e/offline/site.spec.ts
 - frontend/tests/e2e/offline/unset.spec.ts
 - frontend/tests/e2e/stateful/booking-down.spec.ts
 - backend/pyproject.toml
 - backend/tests (mypy typing fixes in 9 files)
 - backend/README.md
 - frontend/README.md
 - .gitleaks.toml
 - specs/005-appointment-booking/tasks.md
 - specs/005-appointment-booking/results.md
tests:
 - pytest 430 passed; mypy 100 files clean; race test 100x20, 0 double bookings
 - vitest 861; e2e 1044 / stateful 17 / offline 258 passed
 - gitleaks clean (path-scoped allowlist); npm audit --omit=dev 0; pip-audit 0
---

## Prompt

/sp.implement Feature 005 (specs/005-appointment-booking). Decisions: keep the shipped demo wording; sharing doctors in e2e is fine. Now do Phase 10 (resilience, polish & proof), plus this polish list:
1) Slip: make the CONFIRMED seal text larger and readable; make the logo watermark lighter so it never sits behind the details text; reduce the desktop gap between the slip and the action buttons; add bottom padding so the sticky mobile Download button never hides the last rows.
2) Fix the 24 old mypy errors in test files.
3) Run the 100-repeat race test (SC-002) and update results.md.
4) Final gate: all tests green, Lighthouse (mobile) on home, doctors and book-appointment, gitleaks secret scan, npm audit and pip-audit reviewed, evidence for every success criterion in results.md.
Run checks one at a time; if a step hangs over 15 minutes, STOP and tell me. Commit, push, then STOP with a final summary of Feature 005 and anything I must check before the PR.

## Response

- Slip polish done (seal, watermark, desktop gap, mobile bottom padding). 24 mypy test errors fixed; mypy now covers tests.
- SC-002: 100 races, 0 double bookings, 13 min.
- T101/T102 e2e added. Lighthouse found a 0.475 CLS on the booking page (Suspense fallback); fixed, now 87 with CLS 0. Score stays under 90 on this laptop, like home and doctors.
- gitleaks: 5 fake-value hits, path-scoped allowlist. npm audit: 0 in production deps; 5 dev-only highs left for a decision.
