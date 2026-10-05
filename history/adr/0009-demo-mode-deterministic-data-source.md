# ADR-0009: Demo Mode as a Read-Only Session Kind over a Deterministic Data Source

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** 006-clinic-command-centre
- **Context:**
  - Portfolio visitors must be able to open a full Command Centre with one click, without an account (US1).
  - SC-005 requires zero mixing: a demo viewer never sees real bookings, and nothing a demo viewer does reaches real data.
  - Demo data must look alive (today's agenda, trends, no-shows) yet stay identical on reload within a day, so tests and visual baselines are stable (FR-011).
  - Demo writes must be refused on the server (FR-014), while the UI still lets visitors try status changes (FR-013).
  - Real bookings share the `appointment` table with the public booking flow and its exclusion constraint (ADR-0005).

## Decision

- **Session kind**: `POST /api/v1/admin/demo/start` (proxy secret + per-IP limit) creates a `demo_session` row (`token_hash`, `demo_date` = Karachi date, `expires_at` = +2 h) and returns a `cd_`-prefixed token in the same cookie as staff. A browser is demo or staff, never both; the prefix picks the table, so a demo token can never become a staff session. Sign-in replaces it.
- **Policy**: demo viewers pass `READ` and `READ_ADMIN` and are refused `WRITE*` with `403 demo_read_only` (ADR-0007).
- **Generator**: `app/demo/generator.py` builds a `DemoDataset` for a Karachi date with `random.Random("shuaib-health-demo:v1:<date>")`. It uses the public sample doctors, departments and schedules plus obviously-sample patient names, covers date −90 to +14 days with realistic distributions, and includes a synthetic activity feed and staff list. Cached with `lru_cache(maxsize=2)` keyed by `(date, catalog_etag)`; budget < 150 ms.
- **Data-source seam**: every Command Centre read goes through a `CommandCentreSource` protocol with `RealSource` (SQL) and `DemoSource` (in memory). One `get_source` dependency chooses by viewer kind. KPI and insight maths are pure functions shared by both.
- **Import guard**: a test fails if `DemoSource` imports the appointment repository, the `Appointment` model or the DB session.
- **Live feel**: today's statuses are derived relative to the request clock, so the demo looks current all day and stays consistent on reload.
- **Demo interactions**: the browser applies status changes to an in-memory overlay keyed by booking reference; reload discards it. Phone reveal returns the synthetic number and writes no audit row.

## Consequences

### Positive

- Zero mixing is structural: demo rows never exist in Postgres and real rows are never read for a demo viewer.
- The demo exercises the exact same KPI, insight and status-rule code as real staff use.
- Deterministic output gives stable tests and visual baselines; the versioned seed lets a generator change roll deliberately.
- Demo traffic costs one session lookup per request and never competes with public booking for rows or slots.

### Negative

- Two implementations of every read (`RealSource` and `DemoSource`) must stay in step; contract tests run both through the same shapes.
- The browser overlay means demo "writes" are UI-only, so a bug in the overlay is not caught by backend tests; it needs its own unit tests.
- The generator must be kept realistic as the product grows (new statuses, new screens).
- Demo data is clearly sample data and labelled as such, so it cannot show real-world volumes.

## Alternatives Considered

- **Demo rows in `appointment` with an `is_demo` flag**: one missed `WHERE` leaks real data or pollutes staff views, and demo rows would collide with the exclusion constraint and public slot availability. Rejected.
- **Demo generated entirely in the browser**: ships the generator to every client and leaves the server nothing to refuse (FR-014). Rejected.
- **Separate demo database**: operational overhead (second Neon branch, migrations, seeding) with no added safety over the seam. Rejected.
- **Shared demo staff account with real credentials**: a real session with write rights waiting to be abused. Rejected.

## References

- Feature Spec: [specs/006-clinic-command-centre/spec.md](../../specs/006-clinic-command-centre/spec.md) (US1, FR-010–014, SC-005)
- Implementation Plan: [specs/006-clinic-command-centre/plan.md](../../specs/006-clinic-command-centre/plan.md) (Key Decision 4, Phase 5)
- Research: [research.md R7, R10](../../specs/006-clinic-command-centre/research.md); [data-model.md](../../specs/006-clinic-command-centre/data-model.md) (demo dataset)
- Related ADRs: ADR-0005 (booking integrity), ADR-0007 (staff auth and policies)
- Evaluator Evidence: [history/prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md](../prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md)
