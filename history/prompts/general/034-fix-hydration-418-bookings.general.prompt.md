---
id: 034
title: Fix hydration error 418 on bookings
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 012-upcoming-bookings
branch: fix/upcoming-hydration
user: Shuaibali0786
command: find and fix React hydration error #418 on /admin/bookings?view=upcoming
labels: ["bugfix","hydration","react","command-centre"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/admin/state/bell.ts
 - frontend/src/admin/bookings/BookingsScreen.tsx
 - frontend/src/admin/overview/CountCards.tsx
 - frontend/src/admin/shell/NewBookingsBell.tsx
 - frontend/tests/unit/bell-hydration.test.tsx
 - frontend/tests/e2e/stateful/admin-hydration.spec.ts
 - frontend/tests/mock-api/admin.mjs
 - frontend/tests/mock-api/server.mjs
tests:
 - vitest 1586 passed; stateful e2e 27 passed; admin e2e 517 passed
---

## Prompt

Find and fix React hydration error #418 on /admin/bookings?view=upcoming. Reproduce locally on a production build (cold load), fix the cause, add a test that catches it, run suites, PR, merge only if green, re-check live. No DB changes.

## Response snapshot

Cause: the shell (and its bell poll) hydrates before the streamed Bookings page; the page read the bell store directly during render, so on a slow cold load it rendered "Mark all seen" (and fresh counts) that the server HTML did not have. Fix: the bell store keeps an immutable state snapshot and every render reads it through useBell() (useSyncExternalStore with an empty server snapshot), so hydration matches the server and the live state follows. Reproduced with a new mock mode admin-search-slow; unit and stateful e2e tests fail on the old code and pass on the fix.

## Outcome

- Impact: no hydration mismatch on cold loads; no DB change
