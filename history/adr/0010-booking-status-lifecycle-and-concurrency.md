# ADR-0010: Booking Status Lifecycle and Concurrency

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** 006-clinic-command-centre
- **Context:**
  - Feature 005 bookings have only `confirmed` and `cancelled`, and the exclusion constraint applies only to `confirmed` rows (ADR-0005).
  - Reception needs to mark patients Arrived, Completed and No-show, and to cancel (FR-023–026).
  - Two receptionists can act on the same booking at once; the spec requires refusing a change if the booking changed since it was shown (FR-025).
  - A mis-tap must be reversible for a short time (undo), and every change must be audited atomically (NFR-004).
  - An Arrived or Completed booking must keep its slot; only cancellation frees it (FR-026).

## Decision

- **Statuses**: `appointment.status` CHECK becomes `confirmed | arrived | completed | no_show | cancelled` (text + CHECK, as in 005).
- **Slot occupancy**: the exclusion constraint's predicate widens from `status = 'confirmed'` to `status <> 'cancelled'`. Slot generation's `CONFIRMED_SQL` becomes `OCCUPYING_SQL`. The per-phone active-booking limit still counts only `confirmed`. **This amends ADR-0005's "only confirmed rows take part".**
- **Rules**: allowed transitions and time rules are pure functions with an injected `Clock` (Arrived ≥ start − 2 h; No-show ≥ start; Cancel < start). The server returns `allowedNext`; the client sends only `to` and `expectedVersion`.
- **Optimistic concurrency**: new `appointment.version` column. The change is one `UPDATE … WHERE reference AND version = :expected AND status = :from RETURNING …`; 0 rows → `409 booking_changed` with the current booking.
- **History and audit**: the same transaction inserts an `appointment_status_change` row (from, to, actor, `undo_expires_at` = now + 10 s) and an `audit_log` row (`booking.status_changed`). All or nothing.
- **Undo**: `POST …/status/undo {changeId}` only if it is the latest change, by the same staff member, within 10 s (+ 2 s network grace), and the version is unchanged; else `409 undo_unavailable`. Undoing a cancel re-occupies the slot; if a public booking took it, `23P01` maps to `409 slot_taken`. Undo is its own history row and audit event.
- **Migration `0003_command_centre`**: reversible, but the downgrade **refuses** if any `arrived` or `no_show` rows exist, rather than silently mapping them and freeing slots.

## Consequences

### Positive

- Double-booking stays impossible at the database level across the wider set of statuses.
- Concurrent edits never overwrite each other silently, with no long-held locks.
- Every status change has a history row and an audit row, or neither.
- Undo is safe under races: it cannot undo someone else's later change or steal a slot back.
- Status rules are pure and clock-injected, so time-boundary tests are exact.

### Negative

- Changes an Accepted ADR's constraint predicate; the migration must recreate the constraint under a short `ACCESS EXCLUSIVE` lock (small table at demo retention).
- Every client must carry `version` and handle `409 booking_changed` with a refresh.
- The refusing downgrade means rollback needs an operator step if new statuses were used (documented).
- A 10-second undo window is short by design; a slower correction is a new status change, not an undo.

## Alternatives Considered

- **Postgres ENUM type**: `ALTER TYPE … ADD VALUE` cannot run inside a transaction in Alembic's default mode and is awkward to downgrade. Rejected.
- **A separate `status_v2` column**: double-writes and a later cut-over. Rejected.
- **Pessimistic locking (`SELECT … FOR UPDATE`) held while the drawer is open**: holds connections across user think time under PgBouncer. Rejected.
- **Last-write-wins**: silently loses a colleague's change. Rejected (FR-025).
- **Undo by deleting the history row**: loses the audit trail. Rejected.
- **Lossy downgrade (`arrived → confirmed`, `no_show → cancelled`)**: could silently free slots. Rejected.

## References

- Feature Spec: [specs/006-clinic-command-centre/spec.md](../../specs/006-clinic-command-centre/spec.md) (FR-023–026, NFR-004)
- Implementation Plan: [specs/006-clinic-command-centre/plan.md](../../specs/006-clinic-command-centre/plan.md) (Key Decision 5, Phases 2 and 7)
- Research: [research.md R8, R9](../../specs/006-clinic-command-centre/research.md); [data-model.md](../../specs/006-clinic-command-centre/data-model.md) (state machine)
- Related ADRs: ADR-0005 (booking integrity — exclusion predicate amended here), ADR-0007 (policies)
- Evaluator Evidence: [history/prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md](../prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md)
