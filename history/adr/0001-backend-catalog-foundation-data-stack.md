# ADR-0001: Backend Catalog Foundation — Data Access and Database Stack

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Proposed
- **Date:** 2026-10-03
- **Feature:** 003-catalog-api
- **Context:** Feature 003 creates the first backend: a read-only catalog API on Neon Postgres that every later client (website, booking, staff app, AI agent) will share. The constitution fixes the libraries (FastAPI, SQLModel, Alembic, psycopg 3, uv, Neon) and requires the pooled URL for the app, the direct URL for migrations, migrations only via Alembic, and database-level enforcement of scheduling rules. Open choices were how to talk to the database (sync vs async, pooling with Neon's PgBouncer), how to represent catalog data, and where integrity rules live. These choices shape every repository, migration and test written after this feature.

## Decision

- **Runtime**: Python 3.12 managed by `uv`; SQLModel 0.0.47 on SQLAlchemy 2.0.x (SQLModel caps < 2.1); psycopg[binary] 3.3.
- **Access style**: synchronous SQLAlchemy `Engine` + SQLModel `Session`; FastAPI routes are plain `def` (threadpool). Routers → repositories (all SQL) → models; separate Pydantic response schemas. No service layer until booking adds business logic.
- **Connections**: app uses Neon **pooled** URL (PgBouncer transaction mode) with `prepare_threshold=None` (no server-side prepared statements), `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=300`; Alembic uses the **direct** URL. `sslmode=require` (or stricter) mandatory; URLs held as `SecretStr` and validated at startup (pooled/direct not swapped, test ≠ dev).
- **Identity**: random UUID4 primary keys (`gen_random_uuid()`), public addressing by slug (unique, pattern-checked).
- **Representation**: money as `integer` PKR; plain string lists as `text[]`; structured clinic values as `jsonb` validated by Pydantic; schedule times as `time` (wall-clock in the clinic's stored timezone); audit columns `timestamptz`; asymmetric relations as separate ordered link tables.
- **Integrity in the database**: CHECK constraints (slug pattern, non-negative PKR, weekday set, `end > start`, language set), singleton clinic-settings row, `btree_gist` exclusion constraint against overlapping sessions per doctor and weekday, FK indexes.
- **Testing**: real Postgres test database (separate Neon branch); migration downgrade/upgrade round trip and `alembic check` drift test; DB tests skipped with a reason when not configured.

## Consequences

### Positive

- Simple, fully typed code that `mypy --strict` checks end to end; the seed command, Alembic and the app share one engine module.
- Turning off automatic prepared statements removes a whole class of "prepared statement does not exist" errors under transaction pooling, independent of Neon server settings.
- Integrity rules hold even for direct database edits, which the future staff/admin tooling and the booking feature (double-booking constraint) build on.
- Opaque UUIDs keep internal IDs non-guessable; slugs keep URLs readable and stable.
- Tests exercise the real SQL features used (arrays, `jsonb`, `ILIKE`, `unnest`, exclusion constraints), so passing tests mean something.

### Negative

- Sync I/O ties up a threadpool worker per in-flight query; at high concurrency an async rewrite of `db.py` and repositories would be needed.
- Pinned to the SQLAlchemy 2.0 line until SQLModel supports 2.1.
- Without prepared statements, repeated queries pay planning cost each time (negligible at catalog scale).
- `text[]`/`jsonb`/exclusion constraints are Postgres-specific; the schema is not portable to other databases, and tests require network access to a Postgres instance.
- `btree_gist` is an extra extension that every environment must allow.

## Alternatives Considered

- **Async stack** (`AsyncSession` + psycopg async, `async def` routes): better concurrency ceiling, but more complex testing and thinner SQLModel async support; no benefit for a small read-only catalog. Rejected for now; contained migration path later.
- **Rely on PgBouncer `max_prepared_statements`** instead of disabling preparation: works on current Neon, but couples correctness to a server setting we do not control. Rejected.
- **`NullPool`** (connect per request): avoids pool staleness but adds a TLS handshake per request, hurting the 200 ms target. Rejected.
- **UUIDv5 from slug / sequential integer IDs**: deterministic or simple, but guessable (against FR-005). Rejected.
- **Child tables for every string list; Postgres enum types**: more joins / painful enum migrations with no query need. Rejected in favour of arrays and CHECK constraints.
- **SQLite or mocks for tests**: fast and offline but lacks the Postgres semantics used; tests would lie. Rejected.

## References

- Feature Spec: [specs/003-catalog-api/spec.md](../../specs/003-catalog-api/spec.md)
- Implementation Plan: [specs/003-catalog-api/plan.md](../../specs/003-catalog-api/plan.md)
- Research: [research.md R1–R3, R16–R17](../../specs/003-catalog-api/research.md); Data model: [data-model.md](../../specs/003-catalog-api/data-model.md)
- Related ADRs: ADR-0002, ADR-0003
- Evaluator Evidence: [history/prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md](../prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md)
