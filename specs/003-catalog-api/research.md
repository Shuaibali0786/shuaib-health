# Research: Backend Foundation + Read-Only Catalog API

**Feature**: 003-catalog-api | **Date**: 2026-10-03

Versions were checked against PyPI on 2026-10-03. Each item: Decision / Rationale / Alternatives.

## R1. Python and package versions

- **Decision**: Python 3.12 (managed by `uv`, already installed at `uv python list`), pinned with `requires-python = ">=3.12,<3.13"` and `.python-version`. Runtime: `fastapi` 0.142.x, `sqlmodel` 0.0.47 (caps `SQLAlchemy >=2.0.14,<2.1`), `alembic` 1.20.x, `psycopg[binary]` 3.3.x, `pydantic-settings` 2.15.x, `uvicorn` 0.54.x. Dev: `pytest` 9.1.x, `httpx` 0.28.x (FastAPI `TestClient`), `pytest-cov` 7.1.x, `ruff` 0.16.x, `mypy` 2.4.x. Locked in `backend/uv.lock`.
- **Rationale**: 3.12 has binary wheels for every dependency on Windows and on Render. SQLModel decides the SQLAlchemy line (2.0), not the latest SQLAlchemy 2.1.
- **Alternatives**: 3.14 (installed, but newest wheels lag; no benefit here); `psycopg[c]` (needs a compiler on Windows).

## R2. Sync or async database access

- **Decision**: Synchronous SQLModel `Session` with a SQLAlchemy `Engine` on psycopg 3; route functions are plain `def`, which FastAPI runs in its threadpool.
- **Rationale**: Read-only catalog, small queries, one instance. Sync code is simpler to test and type-check, and Alembic and the seed command share the same engine code. Moving to async later is a contained change in `db.py` and the repositories.
- **Alternatives**: `AsyncSession` + `psycopg` async (more moving parts, SQLModel async support is thinner); raw SQL (loses typed models the constitution asks for).

## R3. Neon pooled URL with psycopg 3

- **Decision**: App engine uses `DATABASE_URL` (Neon `-pooler` host, PgBouncer transaction mode) with `connect_args={"prepare_threshold": None}`, `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=300`, `connect_timeout=10`. Alembic uses `DIRECT_DATABASE_URL`.
- **Rationale**: psycopg 3 switches to server-side prepared statements after 5 executions; with transaction pooling a later statement can land on a different server connection. Turning automatic preparation off removes that whole class of error at negligible cost for these queries. Pre-ping and recycle handle Neon computes that suspend when idle. Migrations need a session-level connection (advisory locks, DDL), so they use the direct host.
- **Alternatives**: relying on PgBouncer `max_prepared_statements` (works on current Neon but couples us to a server setting); `NullPool` (a new TLS handshake per request, slower).

## R4. Configuration and its validation

- **Decision**: `pydantic-settings` `Settings` read from environment / `backend/.env`. Startup fails (message names the setting, never the value) when:
  - a required setting is missing;
  - any database URL lacks `sslmode=require|verify-ca|verify-full`;
  - `DATABASE_URL` points at a Neon host without `-pooler`, or `DIRECT_DATABASE_URL` points at one with it;
  - `TEST_DATABASE_URL` equals `DATABASE_URL` or `DIRECT_DATABASE_URL` (compared after normalising);
  - `CORS_ORIGINS` contains `*` or a value that is not an `http(s)://host[:port]` origin;
  - `APP_ENV` is not one of `development`, `test`, `production`.
  URL values are `SecretStr`, so `repr`, logs and tracebacks show `**********`.
- **Rationale**: Constitution VII asks for exactly these startup checks; `SecretStr` makes "never print the connection string" the default rather than a rule people must remember.
- **Alternatives**: plain `os.environ` (no types, no validation); `python-dotenv` alone (still no validation). `pydantic-settings` is the one new runtime dependency outside the constitution's named list; it is maintained by the Pydantic team that FastAPI and SQLModel already depend on (recorded in plan Complexity Tracking).

## R5. Response shape and naming

- **Decision**: Separate Pydantic response schemas (`schemas/`), never the table models. Base config `alias_generator=to_camel`, `populate_by_name=True`; routes return by alias. Lists return `Page[T] = { items, total, page, pageSize }`. Detail endpoints return the bare object (no envelope). Images are returned as `ImageAsset { src, alt, width, height }`, built from a stored image key and `IMAGE_BASE_PATH` (default `/images/`).
- **Rationale**: Keeps the database free to change without breaking the frontend contract (FR-016) and stops internal columns (`is_active`, timestamps) from leaking. camelCase matches `frontend/src/types/content.ts` field for field.
- **Alternatives**: returning SQLModel table objects directly (leaks columns, ties the API to the schema); an `{ data }` envelope on details (diverges from the frontend types for no gain).

## R6. Seed data source and parity with the frontend

- **Decision**: A frontend script `frontend/scripts/export-catalog.mts` imports the six catalog mock files (`siteConfig`, `departments`, `doctors`, `labTests` incl. categories, `healthPackages`) and writes `backend/app/seed/data/catalog.json`. The file is committed. A frontend Vitest test (`catalog-export.test.ts`) fails when the committed JSON differs from the current mock data, so the two can never drift silently. Values not present in the mocks (clinic rules, logo, brand colours, `slotMinutes`) live in `backend/app/seed/data/extras.json`.
- **Rationale**: "Exactly the same sample data" is verified mechanically instead of by a hand-port. The catalog files only use `import type`, so Node 24 runs them directly with built-in type stripping; no new tooling.
- **Alternatives**: hand-copy into Python dicts (drifts); the backend reading the TS files (needs Node at seed time); making the backend the source and generating the TS (changes Feature 002, out of scope until Feature 004).

## R7. Seed idempotency and mock IDs

- **Decision**: The seed runs in one transaction. Each record is matched by its natural key (slug; the singleton for clinic settings; `(doctor, weekday, start)` for schedule sessions; `sort_order` for rules) and upserted with `INSERT ... ON CONFLICT (...) DO UPDATE`. New rows get a random UUID4; existing rows keep theirs. Mock IDs such as `dept-cardiology` are used only inside the seed to resolve references (mock id → slug → row) and are never stored. Link tables and schedules for each seeded parent are replaced (delete + insert) inside the same transaction. Rows that are not in the seed data are left untouched. The command refuses when `APP_ENV=production`.
- **Rationale**: Safe to run any number of times (FR-051), IDs stay stable so ETags and caches stay stable, and nothing a future admin adds is deleted.
- **Alternatives**: UUIDv5 derived from slugs (deterministic but guessable, against FR-005); truncate-and-reload (changes IDs every run, destroys non-sample rows).

## R8. Relations that are not symmetric

- **Finding**: `Department.relatedTestSlugs` and `LabTest.relatedDepartmentIds` are curated separately in the mocks and are not mirror images (e.g. some tests list Dental while Dental's related tests differ).
- **Decision**: Two link tables, `department_related_test` (ordered) and `lab_test_related_department` (ordered), each reproducing its mock list exactly.
- **Alternatives**: one symmetric table (would change the data the website shows today, breaking SC-001).

## R9. Search and filtering

- **Decision**: Case-insensitive `ILIKE '%term%'` with `%`, `_` and `\` escaped (`ESCAPE '\'`), bound as parameters. Lab tests match `name` or any `also_known_as` element (`EXISTS (SELECT 1 FROM unnest(also_known_as) a WHERE a ILIKE ...)`). Doctors match `full_name`. `q` is trimmed, 1–60 characters. Weekday filter is `EXISTS` on the schedule table. Unknown department/category slugs produce an empty page.
- **Rationale**: The catalog is tens of rows; a sequential scan is sub-millisecond. Escaping makes `%` and `_` literal (edge case in spec).
- **Alternatives**: `pg_trgm` GIN index or full-text search (worth it at thousands of rows; noted for later, no extension needed now).

## R10. Pagination and ordering

- **Decision**: `page` (1–10 000, default 1) and `pageSize` (1–100, default 20). `total` from `COUNT(*)` with the same filters. Order: departments and categories by `sort_order, name`; doctors by `sort_order, full_name`; lab tests by category `sort_order`, then `sort_order`, then `name`; packages by `sort_order, name`; rules by `sort_order`. Every order ends with `id` as a tiebreaker. `sort_order` columns reproduce mock array order.
- **Rationale**: Offset pagination is right for small, rarely changing catalogs and maps directly to page numbers in the UI. Deterministic order keeps ETags stable.
- **Alternatives**: cursor pagination (no benefit at this size, harder for page-number UIs).

## R11. Rate limiting

- **Decision**: In-house pure ASGI middleware, fixed window per client IP per minute (`RATE_LIMIT_PER_MINUTE`, default 60), in-process dict with periodic eviction, behind a small `RateLimiter` protocol so a shared store (e.g. Redis) can replace it at deployment. Excess requests: 429 with `Retry-After` (seconds to window end) and the standard error body. `/health` is exempt. Client IP is `request.client.host`; `X-Forwarded-For` is used only when `TRUSTED_PROXY_HOPS > 0` (default 0), taking the hop that number of entries from the right.
- **Rationale**: ~60 lines, fully unit-testable with an injected clock, no new dependency. Not trusting `X-Forwarded-For` by default stops callers from spoofing their IP to dodge the limit.
- **Alternatives**: `slowapi` (adds `limits` + a dependency outside the constitution list, decorator-per-route is easy to forget on new routes); limiting only at the edge (not available in local/dev, not testable).

## R12. Request ID, logging and redaction

- **Decision**: ASGI middleware reads `X-Request-ID`; accepted only if it matches `^[A-Za-z0-9._-]{8,64}$`, otherwise a UUID4 hex is generated. Stored in a `contextvars.ContextVar`, returned in `X-Request-ID`, put in every log record and every error body. Logging uses stdlib `logging` with a small JSON formatter (one JSON object per line: `ts`, `level`, `logger`, `msg`, `requestId`, plus allow-listed fields). Access log fields: `method`, `path` (no query string), `route` template, `status`, `durationMs`. Uvicorn's own access log is disabled (it prints query strings). A logging filter replaces any `postgres(ql)://...` substring with `postgresql://***` as a second line of defence. SQLAlchemy echo is always off.
- **Rationale**: Allow-listing fields is safer than trying to strip personal data afterwards; this baseline carries over to auth and booking where PII exists.
- **Alternatives**: `structlog` / `python-json-logger` (nice, but a new dependency for ~30 lines of code).

## R13. Error format and handlers

- **Decision**: One body for every error:
  `{ "error": { "code": "not_found", "message": "Doctor not found.", "requestId": "...", "details": [ { "field": "pageSize", "issue": "must be <= 100" } ] } }` (`details` only for `validation_error`). Handlers: `StarletteHTTPException` (404/405 and app-raised), `RequestValidationError` → 422 (field name from `loc`, message rewritten, the rejected input value is never echoed), `RateLimited` → 429, SQLAlchemy `OperationalError`/`InterfaceError`/`TimeoutError` → 503 `service_unavailable`, `ClinicNotConfigured` → 503 `not_configured`, any other `Exception` → 500 `internal_error` (full traceback logged server-side with the request ID only, never returned). `debug=False` always.
- **Rationale**: FR-030–FR-032. Not echoing input in validation errors avoids reflecting user text back.
- **Alternatives**: RFC 9457 `application/problem+json` (fine, but a nested `error` object is simpler for the frontend's one fetch helper; can be revisited in an ADR).

## R14. Caching: Cache-Control and ETag

- **Decision**: A dependency-free helper used by every catalog route: serialise the response model to JSON bytes once, ETag = weak `W/"<first 32 hex of sha256(body)>"`, compare against `If-None-Match` (handles lists and `*`), return 304 with `ETag` + `Cache-Control` and no body, else 200 with `Cache-Control: public, max-age=<CACHE_MAX_AGE_SECONDS, default 300>`. `/health`, `/ready` and all errors send `Cache-Control: no-store`. `Vary: Origin` is added by the CORS middleware.
- **Rationale**: Content-hash ETags need no `updated_at` bookkeeping and are exactly right for small JSON. Computed per request (cost: one hash of a few KB).
- **Alternatives**: ASGI middleware that buffers every response (also hashes errors and docs; harder to scope); `updated_at`-based ETags (needs max() queries across joined tables).

## R15. Security headers and CORS

- **Decision**: Middleware adds to every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy: ()` for camera, microphone, geolocation, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains` when `APP_ENV=production` or the request scheme is https. Interactive docs (`/docs`, `/redoc`) are enabled only when `APP_ENV=development`, with a relaxed CSP on those two paths only; `/openapi.json` is always available. CORS: Starlette `CORSMiddleware` with `allow_origins=settings.cors_origins`, `allow_methods=["GET"]`, `allow_headers=["If-None-Match", "X-Request-ID"]`, `expose_headers=["ETag", "X-Request-ID", "Retry-After"]`, `allow_credentials=False`.
- **Rationale**: Constitution VI. The frontend will reach the API through a same-origin proxy, so CORS is a narrow fallback, not the main path.
- **Alternatives**: `secure` package (dependency for six headers).

## R16. Database type choices

- **Decision**: `uuid` PKs (`gen_random_uuid()` server default, Postgres ≥13 built-in); slugs `varchar(80)` with `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` and a unique index; money `integer` with `CHECK (>= 0)`; string lists (`qualifications`, `languages`, `also_known_as`, `conditions`, `services`, address lines) as `text[]`; structured clinic values (`opening_hours`, `lab_hours`, `map_area`, `brand_colors`, phones, `credit`, `logo`) as `jsonb` validated by Pydantic on read and by the seed on write; weekday `varchar(3)` with `CHECK (weekday IN ('mon',...,'sun'))`; times `time` (wall-clock in the clinic timezone stored in settings); `created_at`/`updated_at` `timestamptz` default `now()`. Clinic settings singleton enforced with a `singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton)` column. `languages` limited by a `CHECK (languages <@ ARRAY['Urdu','English','Sindhi','Punjabi'])`.
- **Rationale**: Constraints in the database, not only in code (Constitution III spirit). Arrays and JSONB keep the shapes identical to the TS types without extra join tables for plain strings.
- **Alternatives**: Postgres enum types (painful to alter in migrations; a `CHECK` is easier to change); child tables for every string list (more joins, no query need).

## R17. Tests and the test database

- **Decision**: `pytest` with three layers: `tests/unit` (no DB: settings validation, rate limiter with fake clock, request-ID rules, ETag helper, search escaping, error formatting, log redaction, seed mapping), `tests/api` (FastAPI `TestClient` against `TEST_DATABASE_URL`, schema migrated once per session, seeded once, each test in a transaction rolled back), `tests/migrations` (on the test DB: `downgrade base` → `upgrade head` → `downgrade base` → `upgrade head`, plus `alembic check` for model/migration drift). DB tests are marked `db` and **skipped with a clear reason** when `TEST_DATABASE_URL` is not set, so unit tests run anywhere. A guard refuses to run DB tests if `TEST_DATABASE_URL` matches the dev URL. Performance check: a test seeds, warms up, runs 50 list requests per endpoint and asserts p95 server time < 200 ms (marked `perf`, run on demand because it depends on network to Neon).
- **Rationale**: FR-080–FR-082, SC-003. The test DB is a separate Neon branch (or any local Postgres with SSL).
- **Alternatives**: SQLite for tests (no arrays, JSONB, `ILIKE`/`unnest` semantics — tests would lie); testcontainers (needs Docker on Windows).

## R18. Lint and types

- **Decision**: `ruff check` (rules `E,F,I,B,UP,S,SIM,RUF,ASYNC`) and `ruff format --check`; `mypy --strict` on `app/` with the `pydantic.mypy` plugin. Commands exposed as documented `uv run ...` lines (Windows CMD-friendly, no Makefile).
- **Alternatives**: pyright (also fine; mypy has the pydantic plugin and is what most FastAPI docs use).
