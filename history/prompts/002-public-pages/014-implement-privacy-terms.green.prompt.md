---
id: 014
title: Implement Privacy and Terms
stage: green
date: 2026-10-03
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.implement (continuation)
labels: ["implement", "privacy", "terms", "us8"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/002-public-pages/tasks.md (ticks T085-T088)
 - frontend/src/data/legalContent.ts, types/content.ts, lib/content.ts, lib/routes.ts
 - frontend/src/components/legal/LegalPage.tsx
 - frontend/src/app/privacy/page.tsx, app/terms/page.tsx
 - frontend/tests/unit/legal.test.ts, routes.test.ts, honesty.test.ts
 - frontend/tests/e2e/legal.spec.ts, a11y.spec.ts, links.spec.ts
tests:
 - lint, typecheck, unit (463), build, playwright full suite (455 passed, 11 skipped)
---

## Prompt

(Continuation of the Home page review fixes request) ...Then continue with Phase 10 (Privacy and Terms) and stop at the checkpoint.

## Response snapshot

Phase 10 (T085-T088): LegalContent types and plain-language Privacy (this demo, data a real app would collect, health data protection, five roles, lab report access, cookies, questions) and Terms (purpose, sample content, no medical advice, using the site, bookings and payments not live, limits of responsibility), last updated 2 Oct 2026, each stating it is a portfolio demo and not legal advice; every protection is described as what a real version would do. LegalPage with contents anchors; /privacy and /terms; the last placeholders are gone, so the registry is empty (the catch-all route and its removal are Phase 11 work). links.spec's Coming soon example now uses the booking holding page.

## Outcome

Phase 10 checkpoint reached: all eight stories pass; every Feature 001 Coming soon target is real except booking.
