---
id: 003
title: ADRs booking integrity and proxy trust
stage: plan
date: 2026-10-04
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.adr
labels: ["adr", "booking", "exclusion-constraint", "idempotency", "retention", "proxy-secret", "rate-limiting", "fail-fast"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: history/adr/0005-booking-integrity-db-enforcement.md, history/adr/0006-proxy-trust-and-postgres-rate-limiting.md
  pr: null
files:
 - history/adr/0005-booking-integrity-db-enforcement.md
 - history/adr/0006-proxy-trust-and-postgres-rate-limiting.md
 - specs/005-appointment-booking/plan.md
 - specs/005-appointment-booking/research.md
 - specs/005-appointment-booking/spec.md
 - specs/005-appointment-booking/data-model.md
 - specs/005-appointment-booking/quickstart.md
tests:
 - none (planning stage)
---

## Prompt

1) Create both ADRs: booking-integrity-db-enforcement and proxy-trust-and-postgres-rate-limiting.
2) Add to the plan: in demo mode, bookings are automatically purged 7 days after the appointment time (scheduled job or on-startup cleanup), and the booking form shows a short notice "Demo site: please don't enter real medical details". Also: if the proxy secret is missing at startup, the app must fail fast with a clear error instead of running.
3) Then run /sp.tasks.
Stop after tasks and show the phase table.

## Response snapshot

Added the three plan changes first so the ADRs could describe them:
- **Demo purge**: research R12 rewritten. Bookings are deleted 7 days after the appointment, from a startup background task, after each booking, and from the `app.booking.purge` CLI.
- **Fail fast**: new research R13. The backend settings require both secrets (≥ 32 characters). The website's `instrumentation.ts` refuses a production server start without the secret, and the build is unaffected.
- **Form notice**: the exact text "Demo site: please don't enter real medical details" is now in R8.

Updated to match:
- **spec**: FR-054, FR-055, FR-074 text, US7 AS5/AS6, SC-011, SC-012, Clarifications.
- **plan**: Summary, Constitution Check II and VI, structure, Key Decisions 9–10, phases 1/4/5/6/8, NFRs, risks.
- **data-model and quickstart**.

Created the two ADRs:
- **ADR-0005, Booking Integrity Enforced by the Database**: exclusion constraint, slot re-validation in the booking transaction, idempotency key, per-phone advisory lock, UTC time model, reference and masking, demo retention.
- **ADR-0006, Proxy Trust and Postgres Rate Limiting**: website proxy with Origin guard, proxy secret and trusted client IP, fail-fast secrets, HMAC-keyed Postgres counters, two-tier limiting.

ADR-0006 amends ADR-0003; there are no conflicts.

## Outcome

- ✅ Impact: 2 ADRs accepted; plan includes purge, notice and fail-fast
- 🧪 Tests: none (planning); grader below
- 📁 Files: 2 ADRs; spec, plan, research, data-model, quickstart updated
- 🔁 Next prompts: /sp.tasks (requested in the same message)
- 🧠 Reflection: build workers can load instrumentation, so the website check skips the build phase (`NEXT_PHASE`). Without that, fail-fast would break Principle V.

## Evaluation notes (flywheel)

- Failure modes observed: no create-adr script in .specify/scripts; ADRs written with agent tools from adr-template.md
- Graders run and results (PASS/FAIL): ADR grader PASS for both (clustered decisions, ≥ 3 alternatives with rationale, positive and negative consequences, references)
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): add a create-adr script so ADR IDs are allocated automatically
