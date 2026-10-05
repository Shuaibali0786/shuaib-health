# ADR-0005: Booking Integrity Enforced by the Database

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** 005-appointment-booking
- **Context:**
  - Feature 005 opens online booking to anonymous visitors (no login until Feature 007).
  - The constitution (Principle III) requires double-booking to be prevented at the database level, and slot times, fees and statuses to be decided by the server.
  - Visitors book from flaky mobile connections, so double clicks and retries are normal.
  - The backend can run as more than one instance, behind Neon's PgBouncer in transaction mode, so session-scoped locks and in-process state cannot be relied on.
  - Real visitors may type real personal data into a demo, so how long booking data lives is part of the integrity story.
  - These choices fix how every later booking feature (cancel, reschedule, staff dashboard, AI agent) must write appointments.

## Decision

- **No-overlap guarantee**:
  - `appointment.starts_at` / `ends_at` are `timestamptz`.
  - The migration adds `EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')` (`btree_gist`, already installed by `0001`).
  - The service maps SQLSTATE `23P01` on that constraint to `409 slot_taken`, with up to 5 alternatives computed after rollback.
  - Only `confirmed` rows take part, so a later cancel frees the slot with no schema change.
- **Server-side slot validation**: inside the booking transaction, the requested `startsAt` is checked again against a pure slot engine. The engine covers the weekly sessions and the gaps between them (breaks), the slot grid, lead time, leave, holidays, confirmed bookings and the booking window. Client-sent fee, status and end time are ignored.
- **Idempotency**:
  - The client sends an `Idempotency-Key` (UUID v4), stable across retries of one attempt.
  - The server pre-checks it read-only, so a replay returns the original `201` and a key reused with a different payload gets `409 idempotency_key_reused`.
  - The key is then claimed inside the booking transaction with `INSERT … ON CONFLICT DO NOTHING`, so a concurrent duplicate waits on the unique index and replays.
  - Only `request_hash` (SHA-256 of the normalized request) is stored, never the body. Rows exist only for successful bookings and expire after 24 h.
- **Per-phone serialization**: `pg_advisory_xact_lock` on an HMAC of the normalized mobile makes the "max active bookings per mobile" count exact under concurrency. It is transaction-scoped, so it is safe under PgBouncer transaction pooling.
- **Transaction order**: phone lock → claim the idempotency key → re-validate the slot → count active bookings → insert the appointment (a new reference on a unique collision) → link the key → audit row → commit.
- **Time model**:
  - Instants are stored and sent in UTC. Code uses only aware datetimes and normalizes to UTC on read; it does not rely on the session time zone, because of PgBouncer transaction mode.
  - Weekly sessions and holidays are calendar values in `clinic_settings.time_zone`, evaluated with `zoneinfo`.
  - Responses carry `localDate` and `localTime`. `now` comes from an injectable `Clock`.
- **Reference and exposure**:
  - The reference is 10 Crockford base32 characters from `secrets` (2⁵⁰ values), with a unique constraint.
  - After the POST, only a masked view is ever returned (`A**** K****`, `0300****567`, no email or reason). Unknown references get a uniform 404.
- **Demo retention**:
  - With `DEMO_MODE=true` (the default for this portfolio product), appointments are hard-deleted when `ends_at < now() - 7 days` (`BOOKING_PURGE_AFTER_DAYS`).
  - One function runs the purge from three places: a background startup task (lifespan), a capped run after each booking commit, and the `python -m app.booking.purge` CLI for a host scheduler.
  - Idempotency rows cascade; audit rows (no personal data) remain. A purge failure is logged and never blocks startup.

## Consequences

### Positive

- Double-booking is impossible even with racing instances, bypassed application code, manual SQL, or a later change of slot length. A concurrency test (20 simultaneous requests → exactly 1 success) proves it.
- Retries and double clicks are safe end to end, so the website can tell visitors "it's safe to try again" after a timeout.
- No new infrastructure (no Redis, no lock service, no scheduler) and no new dependencies.
- The guarantees live in the schema, so the future staff app and AI agent inherit them by calling the same endpoint (Principle IV).
- Personal data never leaves the server after booking and is gone a week after the visit in demo mode.

### Negative

- Postgres-specific features (gist exclusion, `tstzrange`, advisory locks) tie the booking model to Postgres. That is acceptable under Principle VII, but not portable.
- The exclusion constraint exists only in the migration, not in SQLModel metadata, so `alembic check` and model-only test databases will not create it. Tests must run migrations, as ADR-0001 already requires.
- The booking transaction is longer than a plain insert (lock, key, slot re-check, count, insert). Throughput is bounded by the connection pool; that is fine at demo scale and is watched as a risk.
- A conflict returns `409` after a rollback, so the alternatives are computed in a second short query.
- Hard deletes after 7 days mean old references stop working and nothing remains for analytics. A real clinic must set `DEMO_MODE=false` and define its own retention.
- If the backend never restarts and nobody books, the purge waits until someone runs the CLI.

## Alternatives Considered

- **App-level checks** (`SELECT` then `INSERT`, or `SELECT … FOR UPDATE` on materialized slot rows): races between instances or needs a slot table kept in sync with schedules; fails Principle III. Rejected.
- **`UNIQUE (doctor_id, starts_at)`**: simple, but misses overlaps of different lengths and does not allow freeing cancelled slots without a partial index per status. Rejected for the exclusion constraint.
- **`SERIALIZABLE` isolation with retry loops**: correct, but adds retry logic everywhere and is still enforced by the app, not a constraint. Rejected.
- **Idempotency in Redis, or storing the full response body**: a new service (user excluded Redis), or patient data kept in a cache table. Rejected.
- **Local wall-clock `timestamp` storage**: ambiguous across time zones and DST for white-label clinics. Rejected for UTC instants plus calendar rules.
- **Retention by manual SQL only, or pg_cron**: relies on memory, or on an extension not guaranteed on the Neon plan. Rejected for startup, post-booking and CLI triggers.

## References

- Feature Spec: [specs/005-appointment-booking/spec.md](../../specs/005-appointment-booking/spec.md) (FR-020–032, FR-040–054)
- Implementation Plan: [specs/005-appointment-booking/plan.md](../../specs/005-appointment-booking/plan.md) (Key Decisions 1, 2, 5, 6, 9)
- Research: [research.md R1, R2, R5, R6, R12](../../specs/005-appointment-booking/research.md); [data-model.md §5–§6, §9](../../specs/005-appointment-booking/data-model.md)
- Related ADRs: ADR-0001 (data stack, migrations), ADR-0003 (security baseline), ADR-0006 (proxy trust and rate limiting)
- Evaluator Evidence: [history/prompts/005-appointment-booking/003-adrs-booking-integrity-proxy-trust.plan.prompt.md](../prompts/005-appointment-booking/003-adrs-booking-integrity-proxy-trust.plan.prompt.md)
