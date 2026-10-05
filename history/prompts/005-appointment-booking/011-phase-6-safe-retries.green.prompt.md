---
id: 011
title: Phase 6 safe retries and idempotency
stage: green
date: 2026-10-05
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["idempotency", "retries", "concurrency", "booking"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - backend/app/booking/idempotency.py
 - backend/app/booking/service.py
 - backend/app/routers/appointments.py
 - backend/app/repositories/appointments.py
 - backend/app/repositories/_common.py
 - backend/tests/api/test_idempotency.py
 - frontend/src/lib/booking/idempotency.ts
 - frontend/src/components/booking/BookingFlow.tsx
 - frontend/src/components/booking/DetailsForm.tsx
 - frontend/tests/unit/booking-idempotency.test.ts
 - frontend/tests/unit/booking-flow.test.tsx
 - frontend/tests/e2e/stateful/booking-retry.spec.ts
 - frontend/tests/e2e/mock-api.ts
 - specs/005-appointment-booking/tasks.md
tests:
 - backend/tests/api/test_idempotency.py (14 tests)
 - pytest -k concurrency x3
 - frontend unit (852), stateful e2e (14), main e2e (1032)
---

## Prompt

/sp.implement Feature 005 (specs/005-appointment-booking). Do ONLY Phase 6 (safe retries / idempotency: same retry key -> one booking; double-click and timeout-retry tests). Also:
1) Decision on the Phase 5 transient errors: retry ONCE with a short backoff on transient database errors (OperationalError / connection drop), only where safe thanks to the idempotency key; never retry on constraint/slot_taken. Add a test, and re-run the SC-002 race test 3 times.
2) Fix the mypy error from the slip commit (utc_iso(row.created_at)).
Run checks one at a time; if a step hangs over 15 minutes, STOP and tell me. Commit, push, then STOP with a short summary.

## Response snapshot

Implemented T075-T079: `idempotency.py` (precheck, claim with ON CONFLICT, link, cleanup), claimed before the availability check so a concurrent replay never sees a false slot_taken, key rolled back on every rejection, required UUIDv4 `Idempotency-Key` header. Transient `OperationalError`/`InterfaceError` retried once (0.25 s backoff); safe because a committed first attempt is replayed through the key. Constraint, slot_taken and key-reuse errors are never retried. Fixed mypy (`require_value` for `created_at`). Browser: `useAttemptKey`, synchronous in-flight guard, spinner, safe-retry message with Try again reusing the key.

## Outcome

- ✅ Impact: same key gives one booking, including concurrent and after-commit connection drops.
- 🧪 Tests: backend 407 passed; concurrency 3 runs green; frontend 852 unit, 14 stateful e2e, 1032 main e2e green; mypy app, ruff, typecheck, lint clean.
- 📁 Files: see list above.
- 🔁 Next prompts: Phase 7 (US6 limits).
- 🧠 Reflection: claiming the key before the availability check closes a replay race.

## Evaluation notes (flywheel)

- Failure modes observed: lint rule forbade ref access during render; switched to a closure in useState.
- Graders run and results (PASS/FAIL): all PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
