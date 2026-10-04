---
id: 007
title: Implement phase 3 and 4 booking
stage: green
date: 2026-10-04
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["booking", "slots", "appointments", "frontend-flow", "e2e"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: history/adr/0005-booking-integrity-db-enforcement.md
  pr: null
files:
 - backend/app/booking/slots.py
 - backend/app/booking/service.py
 - backend/app/repositories/availability.py
 - backend/app/routers/slots.py
 - backend/app/routers/appointments.py
 - frontend/src/components/booking/BookingFlow.tsx
 - frontend/src/app/api/booking/appointments/route.ts
 - frontend/src/app/book-appointment/confirmed/[reference]/page.tsx
 - specs/005-appointment-booking/tasks.md
 - specs/005-appointment-booking/results.md
tests:
 - backend/tests/unit/test_slots.py
 - backend/tests/api/test_slots_api.py
 - backend/tests/api/test_appointments_api.py
 - frontend/tests/unit/booking-flow.test.tsx
 - frontend/tests/e2e/booking.spec.ts
---

## Prompt

Feature 005 (specs/005-appointment-booking). Phases 1-2 are done. Do Phase 3 (real slots), commit, then Phase 4 (book in under a minute, MVP). Run the checks one at a time; if any step hangs over 15 minutes or fails on network, STOP and tell me. Commit and push after each phase, then STOP with a short summary and tell me how to try a booking locally.

## Response snapshot

Phase 3: pure slot engine, two-query availability loader (6 queries measured p95 547 ms, 2 queries p95 184 ms), slots endpoint, website slots route, labels. Phase 4: validation, masking, references, audit, booking service and endpoints, website POST proxy with Origin guard, step flow with URL state, confirmation page, holding page removed, e2e keyboard booking with axe.

## Outcome

- Impact: a visitor can book end to end against the mock or the real backend; slots are server-computed.
- Tests: backend 389 passed; Vitest 803 passed; e2e 1028 + 11 stateful + 252 offline passed.
- Files: see list above and git history.
- Next prompts: Phase 5 (23P01 to slot_taken), Phase 6 (idempotency), Phase 7 (limits).
- Reflection: collapsing database round trips mattered more than query tuning on a remote Neon.

## Evaluation notes (flywheel)

- Failure modes observed: shell quoting of long heredocs; first slots version over latency budget.
- Graders run and results (PASS/FAIL): ruff, mypy, pytest, vitest, playwright all PASS.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): none.
