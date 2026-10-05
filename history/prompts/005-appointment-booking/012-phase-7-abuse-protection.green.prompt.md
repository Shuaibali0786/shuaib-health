---
id: 012
title: Phase 7 abuse protection
stage: green
date: 2026-10-05
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["rate-limit", "honeypot", "abuse", "booking"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - backend/app/booking/limits.py
 - backend/app/booking/service.py
 - backend/app/routers/appointments.py
 - backend/app/repositories/appointments.py
 - backend/tests/api/test_booking_limits.py
 - backend/tests/api/test_booking_concurrency.py
 - backend/tests/conftest.py
 - frontend/src/components/booking/BookingFlow.tsx
 - frontend/src/components/booking/DetailsForm.tsx
 - frontend/src/components/booking/RateLimitNotice.tsx
 - frontend/src/lib/booking/client.ts
 - frontend/tests/unit/booking-flow.test.tsx
 - frontend/tests/e2e/stateful/booking-limits.spec.ts
 - specs/005-appointment-booking/tasks.md
tests:
 - backend/tests/api/test_booking_limits.py (11 tests)
 - backend full suite (418 passed, 1 skipped)
 - frontend unit (857), stateful e2e (15)
---

## Prompt

/sp.implement Feature 005 (specs/005-appointment-booking). Do ONLY Phase 7 (abuse protection: per-IP and per-phone limits, max active bookings per phone, honeypot, lookup limits; each must refuse correctly with a friendly message). Run checks one at a time; if a step hangs over 15 minutes, STOP and tell me. Commit, push, then STOP with a short summary.

## Response snapshot

Implemented T080-T083. `limits.py`: one autocommitted upsert per hit on `rate_limit_counter`, HMAC buckets, fixed windows aligned to UTC. Service order: idempotency precheck (replays use no limit), trap (counts an IP hit, audit `trap`, 400), IP limit (429 + audit), phone limit (429 + audit), then in the transaction the per-phone advisory lock, idempotency claim and the active-bookings cap (409 `booking_limit_reached`, audit `limit_reached`). `GET /appointments/{reference}` is lookup-limited per IP. Browser: 429 shows the message, clinic phone and a capped (120 s) countdown with Confirm disabled; limit and rejected messages show the phone. Existing concurrency tests raised the IP limit because 20 racers share one test IP; the `make_client` fixture now clears counters.

## Outcome

All Phase 7 checks green. Limits: 10 bookings per IP per hour, 5 per phone per day, 20 lookups per IP per minute, 3 active bookings per phone (clinic setting).
