# Implementation Plan: Backend Foundation + Read-Only Clinic Catalog API

**Branch**: `003-catalog-api` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-catalog-api/spec.md`

**Note**: Phase 2 of the constitution build order, first backend piece. `/sp.plan` writes documents only; no packages are installed and no app code is written by it.

## Summary

Create `backend/`: a FastAPI service that serves the clinic's public catalog (clinic settings, rules, departments, doctors with weekly schedules, lab test categories, lab tests, health packages) read-only from Neon Postgres under `/api/v1`, plus `/health` and `/ready`. Every clinic value comes from the database (white-label, single-tenant). Response items match `frontend/src/types/content.ts` field for field so Feature 004 can switch from mocks to the API without redesign. The feature also lays the security and privacy baseline every later backend feature reuses: validated settings, SSL-only DB, strict CORS, security headers, per-IP rate limiting, request IDs, allow-listed JSON logs, one error format, ETag caching.

Architecture decisions are recorded in [ADR-0001](../../history/adr/0001-backend-catalog-foundation-data-stack.md) (data access and database stack), [ADR-0002](../../history/adr/0002-public-api-contract-and-white-label-data.md) (public API contract and white-label data) and [ADR-0003](../../history/adr/0003-api-security-and-observability-baseline.md) (security and observability baseline).

Key technical decisions (alternatives in [research.md](./research.md)):

- **Sync SQLModel on psycopg 3**, `def` routes in FastAPI's threadpool; Neon pooled URL with psycopg automatic prepared statements turned off (`prepare_threshold=None`) so PgBouncer transaction pooling is safe (R2, R3).
- **Response schemas are separate from table models**, camelCase by alias, `{ items, total, page, pageSize }` for every list (R5, R10).
- **Seed data is exported from the frontend mocks** to a committed JSON file, guarded by a frontend parity test; the idempotent seed upserts by slug and keeps existing UUIDs (R6, R7).
- **Constraints live in the database**: slug pattern, non-negative PKR, weekday check, `end > start`, no overlapping sessions (exclusion constraint), single settings row, language list (R16).
- **Cross-cutting concerns are small in-house ASGI middlewares** (request ID, access log, security headers, rate limit) and one ETag helper: no extra dependencies, each unit-tested with injected clocks/inputs (R11–R15).
- **Tests run on real Postgres** (separate test database), skipped with a clear reason when it is not configured; migration down/up/down/up test plus `alembic check` drift test (R17).

## Technical Context

**Language/Version**: Python 3.12 (via `uv`; `.python-version`), fully type-hinted, `mypy --strict`
**Primary Dependencies**: fastapi 0.142, sqlmodel 0.0.47 (→ SQLAlchemy 2.0.x), alembic 1.20, psycopg[binary] 3.3, pydantic 2.13, pydantic-settings 2.15, uvicorn 0.54. Dev: pytest 9.1, httpx 0.28, pytest-cov 7.1, ruff 0.16, mypy 2.4
**Storage**: Neon Postgres — dev database (pooled URL for app, direct URL for Alembic) and a separate test database; UUIDs from built-in `gen_random_uuid()` (no `pgcrypto` needed); extension `btree_gist` for the schedule exclusion constraint
**Testing**: pytest — `tests/unit` (no DB), `tests/api` (TestClient + test DB, per-test rollback), `tests/migrations`; markers `db`, `perf`; frontend Vitest parity test for the seed JSON
**Target Platform**: Local Windows dev (CMD); Linux container on Render later (Phase 4, out of scope)
**Project Type**: web (monorepo; this feature adds `backend/` and one script + one test in `frontend/`)
**Performance Goals**: p95 < 200 ms server time for list/detail with page size ≤ 20 against the dev database (SC-003); 304 responses for unchanged catalog data
**Constraints**: no write endpoints; no secrets in repo, logs, errors or test output; SSL required; Windows CMD-friendly commands; no clinic values in code
**Scale/Scope**: 11 tables (8 entity + 3 link), 13 GET endpoints + `/health` + `/ready`; seed: 1 settings, 5 rules, 7 departments, 9 doctors, 9 categories, 26 tests, 5 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.0.0.

- [x] **I. Honesty — PASS.** The demo notice and credit line are served from `clinic_settings` (seeded with the exact constitution text); every seeded record has `is_sample = true` and the API returns `isSample`. No reviews, ratings or third-party marks are introduced. A backend test asserts the seeded `demoNotice` equals the constitution text and that every catalog item has `isSample: true`.
- [x] **II. Privacy — PASS (scope-limited).** No personal or medical data exists in this feature; no roles yet (no protected endpoints). Baseline laid for later: allow-listed JSON logs without query strings, connection-string redaction filter, request IDs, no input echo in errors. Rate limiting covers all public endpoints (the principle requires it for auth/booking/lookup; the middleware is reused there). Log-capture test asserts no secret or URL appears.
- [x] **III. Server truth — PASS.** Prices are stored and returned as integer PKR from the server only; no endpoint accepts prices. Schedule times are wall-clock in the clinic's `time_zone` (Asia/Karachi), `timestamptz` for audit columns. Slot generation and double-booking constraints are booking features (out of scope); the schedule table already carries `slot_minutes` and a DB-level no-overlap constraint.
- [x] **IV. API-first — PASS.** One versioned public API for all clients; typed Pydantic response schemas; OpenAPI committed at [contracts/openapi.yaml](./contracts/openapi.yaml) and generated by the app; documented error taxonomy. A test diffs the app's generated OpenAPI paths/schemas against the committed contract.
- [x] **V. Resilience — N/A now.** The frontend does not call the backend in this feature (Feature 004). The API itself degrades cleanly: 503 with the standard body when the DB is down.
- [x] **VI. Security — PASS.** No auth yet (Argon2/JWT/CSRF arrive with auth; no state-changing endpoints exist, and non-GET returns 405). Strict CORS allow-list (no `*`, no credentials), security headers, SSL-only DB, `SecretStr` settings, `.env` git-ignored (already in root `.gitignore`), `backend/.env.example` with placeholders only.
- [x] **VII. Databases — PASS.** Pooled URL for app, direct URL for Alembic, startup validation rejects swapped URLs, missing SSL, and a test URL equal to a dev URL; schema only via Alembic; migration up/down test on the test DB. Production database is out of scope (deployment phase).
- [x] **VIII. Design/a11y — N/A.** No UI. Brand colour tokens are now also stored as data (`brandColors`) for white-label; the frontend's Tailwind tokens remain the source for this site until Feature 004 decides otherwise.
- [x] **IX. Quality — PASS.** Python fully typed (`mypy --strict`), ruff lint/format, unit tests for every piece of logic (settings validation, rate limiter, request ID, ETag, search escaping, error mapping, redaction, seed mapping), API tests per endpoint, migration test. Work is split into small reviewable phases (below).
- [x] **X. Build order — PASS.** Phase 1 acceptance checks passed (Feature 002 merged; T099 Lighthouse deferred to the Vercel deploy by an explicit, recorded decision). This is Phase 2 work and references no Phase 3+ deliverable.

**Post-design re-check (after Phase 1 artifacts)**: still PASS. The design added one dependency outside the named stack (`pydantic-settings`, justified below) and one Postgres extension (`btree_gist`, standard on Neon).

## Project Structure

### Documentation (this feature)

```text
specs/003-catalog-api/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: tables, constraints, API field mapping
├── quickstart.md        # Phase 1: Windows CMD setup/run/test (becomes README section)
├── contracts/
│   └── openapi.yaml     # Phase 1: public API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/sp.tasks — NOT created by /sp.plan)
```

### Source Code (repository root)

New paths `+`, changed `~`.

```text
backend/                                   +
├── pyproject.toml                         + deps, ruff, mypy, pytest config (markers db, perf)
├── uv.lock                                + 
├── .python-version                        + 3.12
├── .env.example                           + placeholders only
├── README.md                              + Windows CMD quickstart (from quickstart.md)
├── alembic.ini                            + script_location only; URL comes from settings
├── migrations/
│   ├── env.py                             + uses DIRECT_DATABASE_URL (or TEST_ via -x target=test)
│   └── versions/0001_catalog.py           + tables, constraints, indexes, btree_gist; full downgrade
├── app/
│   ├── main.py                            + create_app(): middlewares, handlers, routers, docs gating
│   ├── settings.py                        + pydantic-settings Settings + validators (R4)
│   ├── db.py                              + engine factory (pool, prepare_threshold=None), get_session
│   ├── models.py                          + SQLModel tables (data-model.md)
│   ├── schemas.py                         + camelCase response models, Page[T], Error
│   ├── errors.py                          + AppError types, exception handlers, error body builder
│   ├── http_cache.py                      + ETag / Cache-Control / 304 helper
│   ├── middleware/
│   │   ├── request_id.py                  + contextvar + header
│   │   ├── access_log.py                  + JSON access line, no query string
│   │   ├── security_headers.py            +
│   │   └── rate_limit.py                  + RateLimiter protocol, in-memory fixed window, client IP
│   ├── logging_config.py                  + JSON formatter, redaction filter
│   ├── params.py                          + shared Query/Path validators (page, pageSize, q, slug, day)
│   ├── repositories/                      + one module per resource; pure query functions
│   │   ├── clinic.py  departments.py  doctors.py  lab_tests.py  packages.py
│   ├── routers/                           +
│   │   ├── health.py  clinic.py  departments.py  doctors.py  lab_tests.py  packages.py
│   └── seed/
│       ├── __main__.py                    + `python -m app.seed` (refuses production)
│       ├── loader.py                      + validate JSON → upsert in one transaction
│       └── data/catalog.json, extras.json + exported mocks; rules/logo/colours/slotMinutes
└── tests/
    ├── conftest.py                        + settings fixtures, test-DB guard, migrate+seed once, rollback per test
    ├── unit/                              + settings, rate limit, request id, etag, search escape, errors, logging, seed mapping
    ├── api/                               + per endpoint: shape parity, filters, paging, 404/405/422/429, CORS, headers, 304, 503
    ├── migrations/                        + down→up→down→up, alembic check
    └── perf/                              + p95 < 200 ms (marker perf)

frontend/
├── scripts/export-catalog.mts             + writes backend/app/seed/data/catalog.json from src/data
└── tests/unit/catalog-export.test.ts      + committed JSON == current mocks
```

**Structure Decision**: the monorepo's `backend/` per the constitution, with a flat `app/` package (routers → repositories → models; schemas separate). Routers only parse/validate params and shape responses; repositories hold all SQL and are tested through the API against real Postgres. No service layer yet: there is no business logic beyond querying; the booking feature will add `services/`.

## Design Overview

### Request pipeline (outermost first)
`RequestID` → `AccessLog` → `SecurityHeaders` → `CORS` → `RateLimit` (skips `/health`) → router → exception handlers. Request ID is outermost so even 429s and 500s carry it; security headers wrap CORS so preflight responses get them too.

### Endpoint behaviour
- List: validate params (`params.py`) → repository returns `(rows, total)` → map to schema → `http_cache.respond(request, model)` (ETag/304/Cache-Control).
- Detail: repository by slug (active only, including active parent department for doctors) → `NotFound(resource)` → same cache helper.
- `/clinic`: no row → `ClinicNotConfigured` → 503 `not_configured`.
- `/ready`: `SELECT 1` plus `alembic_version` equals head revision embedded at build time; 503 otherwise. `/health`: static `{status: "ok"}`, `no-store`.
- Unknown query parameters are ignored; non-GET on known paths → 405 in standard format; unknown paths → 404 in standard format.

### Contract parity
`tests/api/test_parity.py` loads `catalog.json`, calls each endpoint, and compares each item to its mock by slug: every frontend field equal, except `id` (UUID) and ID references, which are checked to resolve to the right slug. Additive fields (`slotMinutes`, `logo`, `brandColors`, package `tests`) are checked separately.

### Error taxonomy
See research R13 and `contracts/openapi.yaml#/components/schemas/Error`: `not_found` 404, `method_not_allowed` 405, `validation_error` 422, `rate_limited` 429, `internal_error` 500, `service_unavailable` 503, `not_configured` 503.

## Implementation Phases (for /sp.tasks)

| Phase | Scope | Exit check |
|-------|-------|-----------|
| A. Skeleton | `pyproject`, uv lock, settings + validation, logging, request ID, security headers, error handlers, `/health`, ruff/mypy/pytest wiring, `.env.example`, README | `uv run pytest` (unit) green; app starts; bad settings fail fast |
| B. Schema | models, Alembic `0001_catalog`, `/ready`, migration test, `alembic check` | up/down/up on test DB; `/ready` 200 |
| C. Seed | frontend export script + parity test, `extras.json`, loader, production refusal | seed 3× → same counts; Vitest parity green |
| D. P1 doctors & departments | params, repositories, routers, ETag helper, parity + filter + error tests | US1 scenarios pass |
| E. P1 lab tests & packages | categories, tests, packages | US2 scenarios pass |
| F. P2 clinic & rules | `/clinic`, `/clinic/rules`, not-configured path | US3 scenarios pass |
| G. Hardening | rate limit, CORS tests, log-redaction test, OpenAPI diff test, perf test | US5 + SC-003, SC-005, SC-006 |

## Risks

1. **Neon latency from Pakistan to the region** may make the 200 ms target network-bound. Mitigation: measure server-side time (middleware `durationMs`), keep one query per list plus one batched query per relation (no N+1), pick the Neon region closest to the developer; note results in the perf test output.
2. **Mock drift** between frontend data and seed JSON. Mitigation: the Vitest parity test fails the frontend suite on any difference.
3. **In-memory rate limit** does not share state across instances. Mitigation: `RateLimiter` protocol; replace with a shared store at deployment (Phase 4).

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| `pydantic-settings` (runtime dependency not named in the constitution stack) | Typed, validated env configuration with `SecretStr` (Constitution VI, VII startup checks) | Hand-rolled `os.environ` parsing duplicates validation and makes secret masking opt-in |
| `btree_gist` extension | DB-level "no overlapping sessions" exclusion constraint | App-only check can be bypassed by direct DB edits; constitution prefers DB constraints for scheduling |
