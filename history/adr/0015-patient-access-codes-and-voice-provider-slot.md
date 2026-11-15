# ADR-0015: Patient self-service access by reference or email code, and pluggable voice and code providers

- **Status:** Proposed — **Phase 2** (recorded at the owner's request, 2026-11-08). The patient-access half is not built in Phase 1. Only the browser `SpeechPort` slot ships in Phase 1.
- **Date:** 2026-11-08
- **Feature:** 013-voice-receptionist
- **Context:**
  - The voice receptionist lets a returning patient check or cancel a booking without an account. There are no patient accounts (ADR-0007 covers staff only).
  - The booking reference is a 50-bit random secret. The existing masked booking view already shows the last 3 phone digits (see "Known gap" below).
  - Serverless rules (constitution 1.2.0): no background work; limits and locks live in Postgres. Free tiers only; email is Resend (3,000/month, 100/day, shared with clinic alerts).
  - The owner wants paid providers (SMS, WhatsApp, premium voices) pluggable later by configuration only.

## Decision
- **Two lookup routes, one result shape**: (1) reference + last 4 phone digits; (2) a 6-digit code emailed to the booking's email. Both return only date, time, doctor, department, status, and a fresh slip, in the existing masked `AppointmentView` shape. Name + phone + email alone never reveals anything.
- **Codes**: 6 digits from `secrets`, stored only as `HMAC-SHA256(privacy_hash_key, id ‖ code)`, compared in constant time. Valid 10 minutes, single use, 3 tries, resend after 60 s (a resend does not reset tries). A new code expires older ones.
- **Uniform failure**: every input-dependent failure is the same `404 not_found` after a minimum response time (about 300 ms). "Send code" is always `202`. A code is sent only when a matching booking exists, so an attacker cannot tell.
- **Locks**: 3 failures for a hashed reference, email or caller IP lock that target for 1 hour. This reuses `rate_limit_counter` (ADR-0006) with new bucket prefixes and a read-only `peek()`.
- **Cancel**: requires a valid code for that booking plus the caller's spoken yes (client side). The server uses the existing status rules and writes only the audit log, because `appointment_status_change` requires a staff actor.
- **Schema**: one additive table `patient_access_code`, and wider `audit_log` CHECK lists (migration `0006_patient_access`).
- **Provider slots**:
  - `CodeSender` on the backend, with `email` as the only v1 value of `LOOKUP_CODE_CHANNEL`. SMS and WhatsApp are reserved values that fail validation until a sender exists.
  - `SpeechPort` in the browser, with `browser` as the only implementation. A premium voice is one adapter plus a setting.
  - The existing `AgentProvider` (ADR-0013) is unchanged.

## Consequences
- Positive: returning patients get self-service with no accounts and no cost. Brute force is bounded (3 tries, 1-hour locks, uniform responses). Paid channels and voices can be added without changing conversations.
- Negative: a new public, unauthenticated surface (4 endpoints) to keep rate-limited and watched. Email deliverability and the 100/day cap limit the code route. A patient cancel has no row in `appointment_status_change`, so staff cannot Undo it. A migration is needed.
- Known gap (owner decision, deferred to Phase 2 notes): `GET /appointments/{reference}` already shows date, time, doctor, status and the last 3 phone digits to anyone holding the reference. This makes "reference + last 4" only about one digit stronger. It is left unchanged for now.
- Phase 1 impact: none on the backend. `SpeechPort` ships with the browser adapter only.

## Alternatives considered
1. **Patient accounts with passwords or magic links**: stronger identity, but much larger scope, and against "minimal endpoints". Rejected for now.
2. **Signed lookup link emailed instead of a code**: no typing, but cannot be spoken, which is the point of the voice flow. Rejected.
3. **Allow name + phone + email lookup**: easy to say, but all three are often known to others. Rejected by the owner.
4. **Make `appointment_status_change.actor_staff_id` nullable** to record patient cancels: not additive, and changes undo semantics. Rejected.
5. **Hard-code browser speech and email**: simpler now, but each paid provider would then touch the conversation code. Rejected.

## References
- specs/013-voice-receptionist/spec.md, plan.md, research.md (R6–R8, R10), data-model.md, contracts/patient-access-api.md
- ADR-0006 (Postgres rate limiting), ADR-0007 (staff auth), ADR-0013 (agent provider interface)
