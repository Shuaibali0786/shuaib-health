---
id: 001
title: Specify catalog API integration
stage: spec
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.specify
labels: ["spec", "frontend", "api-integration", "resilience", "white-label"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/004-catalog-api-integration/spec.md
 - specs/004-catalog-api-integration/checklists/requirements.md
tests:
 - none (specification stage)
---

## Prompt

/sp.specify Feature 004: Connect the public website to the catalog API (Feature 003).

Goal: doctors, departments, lab tests, test categories, health packages, clinic settings (name, phone, address, hours, logo) and clinic rules on the public site must come from the backend API instead of hard-coded frontend data, so a clinic can change its data without touching code (white-label).

Requirements:
- Every public page that shows catalog data reads it from the API. Remove the duplicated hard-coded catalog data from the frontend (keep it only as test fixtures if needed).
- The site must never break if the API is slow, asleep (Render free tier cold start ~50s) or down: the production build must NOT depend on the API being reachable, and pages show a graceful fallback (last good data or a friendly message), never a crash or blank page.
- Fast: cache API responses on the Next.js side (revalidate about every 5 minutes, matching the API Cache-Control/ETag), no request waterfalls, Lighthouse-friendly. Home and listing pages should stay as fast as today.
- One API base URL from environment config (server-side only, no secrets in the browser); different values for local, preview and production.
- Typed API client in the frontend that matches backend/openapi.yaml; a contract test fails if they drift.
- Add the missing brand/logo-mark.svg referenced by the seeded clinic settings (simple, premium, original mark; no other brand's logo).
- Keep all existing frontend tests passing; update them to use the API layer with mocks; add tests for API-down and slow-API cases.
- Keep the "Sample" / portfolio-demo labels exactly as they are.
- No visual design changes in this feature.

Out of scope: booking, login/OTP, admin, deploy (later features).

## Response snapshot

Created branch `004-catalog-api-integration` and spec with 4 user stories (live catalog P1, resilience P1, clinic identity & rules P2, developer contract/config P2), FR-001..FR-072, SC-001..SC-009, edge cases (partial outage, unknown slug vs outage, malformed data, pagination, dangling references), assumptions (contract lives at specs/003-catalog-api/contracts/openapi.yaml, 3 s time budget, last-good-data not guaranteed across redeploys, logo derived from existing mark). Two clarifications left open: where clinic rules appear (no page shows them today; no design changes allowed) and what clinic identity/emergency number shows on a fresh start with the service down.

## Outcome

- ✅ Impact: Spec ready pending 2 clarifications
- 🧪 Tests: none (spec stage)
- 📁 Files: spec.md, checklists/requirements.md
- 🔁 Next prompts: answer Q1/Q2, then /sp.plan
- 🧠 Reflection: User's "remove hard-coded data" plus "no design changes" conflicts with rules display and safety-critical emergency number on cold outage.

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 printed a parameter-binding error from the shell wrapper after succeeding; branch and spec file were created correctly.
- Graders run and results (PASS/FAIL): spec quality checklist — PASS except open clarifications
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
