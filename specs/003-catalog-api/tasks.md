---

description: "Task list for Feature 003: backend foundation + read-only clinic catalog API"
---

# Tasks: Backend Foundation + Read-Only Clinic Catalog API

**Input**: Design documents from `/specs/003-catalog-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md; ADR-0001..0003 in `history/adr/`
**Branch**: `003-catalog-api`

**Tests**: Required by constitution Principle IX and spec FR-080–FR-082. Tests sit inside each phase next to the code they cover. Story API tests are written first in each story phase and must fail (404 for missing routes) before the routes exist.

**Organization**: Phases 1–2 are shared groundwork (plan Phases A–C). Each story phase is an independently testable slice (plan Phases D–G). The seed **loader** is foundational because every story's API tests need seeded data; US4 covers the seed's guarantees (idempotency, production refusal, frontend parity).

| Story | Priority | Title | Phase |
|-------|----------|-------|-------|
| US1 | P1 | Browse doctors and departments through the API | 3 (MVP) |
| US2 | P1 | Browse lab tests and health packages through the API | 4 |
| US3 | P2 | Read white-label clinic settings and rules | 5 |
| US4 | P2 | Load sample data safely and repeatedly | 6 |
| US5 | P2 | Operate the backend safely | 7 |
| - | - | Polish, contract diff, performance, docs | 8 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5, only in story phases
- Paths are relative to the repository root `D:\shuaib-health`; `backend/` is the Python project root.

## Conventions for every task

- **Windows CMD** commands, run from `D:\shuaib-health\backend` unless stated: `uv sync`, `uv run pytest`, `uv run ruff check .`, `uv run mypy app`, `uv run alembic ...`, `uv run python -m app.seed`.
- Python 3.12, every function fully type-hinted; `mypy --strict` and `ruff check` clean after every task. No `# type: ignore` without a reason comment.
- **No clinic values in `backend/app/`** (no "Shuaib", phone numbers, addresses, colours, "Karachi", "Asia/Karachi"); they live only in `backend/app/seed/data/*.json` and tests.
- **Never print, log or echo secrets** (DB URLs, passwords) in code, tests, test output or chat. Settings URLs are `SecretStr`; read them with `.get_secret_value()` only in `db.py` and `migrations/env.py`.
- Response models live in `backend/app/schemas.py` and use camelCase aliases; never return SQLModel table objects from routes.
- Every route is `def` (sync), returns through `app.http_cache.respond(...)`, and is registered in `backend/app/main.py`.
- DB tests are marked `@pytest.mark.db` and run against `TEST_DATABASE_URL` only; without it they are skipped with the reason "TEST_DATABASE_URL not set".

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Python project, tooling, configuration template.

- [X] T001 Create the backend layout with empty `__init__.py` files: `backend/app/__init__.py`, `backend/app/middleware/__init__.py`, `backend/app/repositories/__init__.py`, `backend/app/routers/__init__.py`, `backend/app/seed/__init__.py`, `backend/app/seed/data/` (no init), `backend/tests/__init__.py`, `backend/tests/unit/__init__.py`, `backend/tests/api/__init__.py`, `backend/tests/migrations/__init__.py`, `backend/tests/perf/__init__.py`; add `backend/.python-version` containing `3.12`
- [X] T002 Create `backend/pyproject.toml`: `[project] name = "clinic-backend"`, `requires-python = ">=3.12,<3.13"`, dependencies `fastapi>=0.142,<0.143`, `sqlmodel==0.0.47`, `alembic>=1.20,<1.21`, `psycopg[binary]>=3.3,<3.4`, `pydantic>=2.13,<3`, `pydantic-settings>=2.15,<3`, `uvicorn>=0.54,<0.55`; `[dependency-groups] dev = ["pytest>=9.1,<10", "httpx>=0.28,<0.29", "pytest-cov>=7.1,<8", "ruff>=0.16,<0.17", "mypy>=2.4,<3"]`; `[tool.ruff]` `target-version = "py312"`, `line-length = 100`, `lint.select = ["E","F","I","B","UP","S","SIM","RUF","ASYNC"]`, per-file-ignores `tests/** = ["S101","S105","S106"]`; `[tool.mypy]` `strict = true`, `plugins = ["pydantic.mypy"]`, `files = ["app"]`; `[tool.pytest.ini_options]` `testpaths = ["tests"]`, `markers = ["db: needs TEST_DATABASE_URL", "perf: performance check, run on demand"]`, `addopts = "-m 'not perf' -ra"`. Then run `uv sync` to create `backend/uv.lock` and `backend/.venv`
- [X] T003 [P] Create `backend/.env.example` with placeholder values only, exactly the variables in `specs/003-catalog-api/quickstart.md` step 2 (`APP_ENV`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `TEST_DATABASE_URL`, `CORS_ORIGINS`, `RATE_LIMIT_PER_MINUTE`, `TRUSTED_PROXY_HOPS`, `CACHE_MAX_AGE_SECONDS`, `IMAGE_BASE_PATH`, `LOG_LEVEL`) with `USER:PASSWORD@ep-xxx...` placeholders and a comment line per variable
- [X] T004 [P] Append Python ignores to the root `.gitignore`: `.venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.coverage`, `htmlcov/`; confirm with `git check-ignore backend/.env` that the existing `.env` rule covers `backend/.env` and that `backend/.env.example` is not ignored

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: settings, logging, middleware, errors, schemas base, database, migration, app factory, test fixtures, seed loader. **No user story work can begin until this phase is complete.**

### Configuration and logging

- [X] T005 Implement `backend/app/settings.py`: `class Settings(BaseSettings)` (`env_file=".env"`, `extra="ignore"`) with fields `app_env: Literal["development","test","production"]`, `database_url: SecretStr`, `direct_database_url: SecretStr`, `test_database_url: SecretStr | None = None`, `cors_origins: list[str]` (parsed from comma-separated string via `NoDecode` + validator), `rate_limit_per_minute: int = Field(60, ge=1, le=10000)`, `trusted_proxy_hops: int = Field(0, ge=0, le=5)`, `cache_max_age_seconds: int = Field(300, ge=0, le=86400)`, `image_base_path: str = "/images/"`, `log_level: str = "INFO"`. Validators per research R4: each URL must start with `postgresql+psycopg://` and have query `sslmode` in `{require, verify-ca, verify-full}`; if host ends with `.neon.tech` then `database_url` host must contain `-pooler` and `direct_database_url` host must not; `test_database_url` (if set) must differ (normalised: lower-case host, no query) from both others; every CORS origin must match `^https?://[A-Za-z0-9.-]+(:\d{1,5})?$` and `*` is rejected. Error messages name the field, never the value. Expose `get_settings()` with `functools.lru_cache`
- [X] T006 [P] Unit tests in `backend/tests/unit/test_settings.py`: valid config loads; each rule in T005 fails with a message naming the field; the `ValidationError` text and `repr(settings)` never contain the password from the test URL (use a fake URL such as `postgresql+psycopg://u:SECRETPW@ep-a-pooler.x.aws.neon.tech/db?sslmode=require`)
- [X] T007 Implement `backend/app/logging_config.py`: `request_id_var: ContextVar[str]` (default `"-"`); `JsonFormatter` emitting one JSON object per line with `ts` (ISO UTC), `level`, `logger`, `msg`, `requestId`, plus only allow-listed extras `method`, `path`, `route`, `status`, `durationMs`, `event`; `RedactFilter` replacing `postgres(?:ql)?(\+\w+)?://\S+` with `postgresql://***` in message and exception text; `configure_logging(level)` installs both on the root logger and sets `uvicorn.access` to `WARNING` and `sqlalchemy.engine` to `WARNING`
- [X] T008 [P] Unit tests in `backend/tests/unit/test_logging.py`: formatter output is valid JSON with the expected keys; non-allow-listed extras (e.g. `phone`, `query`) are dropped; a message and an exception containing a postgres URL are redacted; `requestId` comes from the context var

### Middleware, errors, shared schemas

- [X] T009 [P] Implement `backend/app/middleware/request_id.py`: pure ASGI middleware; accept incoming `X-Request-ID` only if it matches `^[A-Za-z0-9._-]{8,64}$`, else `uuid4().hex`; set `request_id_var` for the request, store in `scope["state"]["request_id"]`, add `X-Request-ID` to the response headers
- [X] T010 [P] Implement `backend/app/middleware/access_log.py`: pure ASGI middleware logging one `INFO` record per request with extras `event="request"`, `method`, `path` (scope path only, never the query string), `route` (matched route path template if available, else `None`), `status`, `durationMs` (rounded to 0.1, `time.perf_counter`)
- [X] T011 [P] Implement `backend/app/middleware/security_headers.py`: pure ASGI middleware adding `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (for paths `/docs` and `/redoc` instead: `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: https://fastapi.tiangolo.com; frame-ancestors 'none'`), and `Strict-Transport-Security: max-age=63072000; includeSubDomains` when constructed with `hsts=True` or the scope scheme is `https`
- [X] T012 Implement `backend/app/schemas.py` base: `CamelModel(BaseModel)` with `ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)`; `ImageAsset(src, alt, width, height)`; generic `Page[T]` (`items: list[T]`, `total: int`, `page: int`, `page_size: int`); `ErrorDetail(field, issue)`, `ErrorInfo(code, message, request_id, details: list[ErrorDetail] | None = None)` serialised without `None` fields, `ErrorResponse(error: ErrorInfo)`; `HealthStatus(status: Literal["ok","unavailable"])`; helper `image_asset(key, alt, width, height, base_path) -> ImageAsset` joining base path and key with exactly one `/`
- [X] T013 Implement `backend/app/errors.py`: exceptions `NotFound(resource: str)`, `ClinicNotConfigured`, `RateLimited(retry_after: int)`; `error_response(status, code, message, details=None, headers=None) -> JSONResponse` (body per `ErrorResponse`, `Cache-Control: no-store`, request id from `request_id_var`); `register_exception_handlers(app)` mapping: `StarletteHTTPException` 404 → `not_found` "Not found.", 405 → `method_not_allowed`, other codes → generic; `RequestValidationError` → 422 `validation_error` with `details` built from `loc[-1]` (camelCase name) and a rewritten issue text, never the input value; `NotFound` → 404 "`<Resource>` not found."; `ClinicNotConfigured` → 503 `not_configured`; `RateLimited` → 429 `rate_limited` + `Retry-After`; `sqlalchemy.exc.OperationalError`/`InterfaceError`/`TimeoutError` → 503 `service_unavailable` (log at `ERROR` with exception class name only); any other `Exception` → 500 `internal_error` "Something went wrong." (log `logger.exception` server-side)
- [X] T014 [P] Unit tests in `backend/tests/unit/test_errors.py` using a throwaway FastAPI app with one route per error type: body shape, status codes, `requestId` present, `Retry-After` on 429, `no-store`, the 422 body does not contain the submitted bad value, and the 500 body contains no exception text or traceback
- [X] T015 Implement `backend/app/params.py`: reusable `Annotated` types — `PageParam = Annotated[int, Query(ge=1, le=10000)]` default 1, `PageSizeParam = Annotated[int, Query(alias="pageSize", ge=1, le=100)]` default 20, `SearchParam = Annotated[str | None, Query(min_length=1, max_length=60)]` (stripped; empty after strip → treated as `None`), `SlugPath = Annotated[str, Path(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]`, `SlugQuery` (same rules, optional), `Weekday = Literal["mon","tue","wed","thu","fri","sat","sun"]`
- [X] T016 Implement `backend/app/http_cache.py`: `respond(request: Request, model: BaseModel, max_age: int) -> Response` — serialise with `model.model_dump_json(by_alias=True)`, ETag `W/"<first 32 hex of sha256(body)>"`, parse `If-None-Match` (comma list, weak/strong, `*`); on match return `Response(status_code=304)` with `ETag` and `Cache-Control`; else `Response(body, media_type="application/json")` with `ETag` and `Cache-Control: public, max-age=<max_age>`
- [X] T017 [P] Unit tests in `backend/tests/unit/test_http_cache.py`: same body → same ETag; different body → different ETag; `If-None-Match` exact, in a list, with `W/` stripped, and `*` → 304 with no body; non-matching → 200 with headers
- [X] T018 [P] Unit tests in `backend/tests/unit/test_request_id.py`: valid incoming ID is echoed; too short, too long, and `bad id!` are replaced with a 32-hex ID; ID is set in the context var during the request

### Database

- [X] T019 Implement `backend/app/db.py`: `make_engine(url: SecretStr) -> Engine` using `create_engine(url.get_secret_value(), pool_size=5, max_overflow=5, pool_pre_ping=True, pool_recycle=300, connect_args={"prepare_threshold": None, "connect_timeout": 10}, echo=False)`; module-level lazy `get_engine()` from `get_settings().database_url`; FastAPI dependency `get_session() -> Iterator[Session]`; `SessionDep = Annotated[Session, Depends(get_session)]`
- [X] T020 Implement all tables in `backend/app/models.py` exactly per `specs/003-catalog-api/data-model.md`: `ClinicSettings`, `ClinicRule`, `Department`, `Doctor`, `DoctorWeeklySchedule`, `LabTestCategory`, `LabTest`, `HealthPackage`, `DepartmentRelatedTest`, `LabTestRelatedDepartment`, `HealthPackageTest` as `SQLModel, table=True`; use `sa_column`/`sa_type` for `UUID(as_uuid=True)` with `server_default=text("gen_random_uuid()")`, `ARRAY(Text)`, `JSONB`, `Time`, `DateTime(timezone=True)` with `server_default=func.now()`; table names snake_case singular as in data-model.md; declare CHECK, UNIQUE, FK (`ondelete` as listed) and indexes in `__table_args__` with explicit names (`ck_<table>_<rule>`, `uq_...`, `ix_...`) so the migration and `alembic check` agree; the schedule exclusion constraint is created only in the migration (note it in a comment)
- [X] T021 Set up Alembic: `backend/alembic.ini` (only `script_location = migrations` and logging config; **no URL**), `backend/migrations/script.py.mako`, `backend/migrations/env.py` that imports `app.models`, uses `SQLModel.metadata` as `target_metadata`, and picks the URL from settings: `direct_database_url` by default, `test_database_url` when run with `-x target=test` (refuse if it is unset); `compare_type=True`; online mode only, `NullPool`
- [X] T022 Write migration `backend/migrations/versions/0001_catalog.py` (revision id `0001_catalog`): `CREATE EXTENSION IF NOT EXISTS btree_gist`; create all 11 tables with every constraint and index named as in T020; add `ex_doctor_weekly_schedule_no_overlap` `EXCLUDE USING gist (doctor_id WITH =, weekday WITH =, tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) WITH &&)`; `downgrade()` drops everything in reverse dependency order (leave the extension in place)
- [X] T023 Implement `backend/app/routers/health.py`: `GET /health` → `{"status":"ok"}` with `Cache-Control: no-store`, no DB access; `GET /ready` → runs `SELECT 1` and reads `alembic_version.version_num`, 200 `{"status":"ok"}` only if it equals the head revision obtained from `alembic.script.ScriptDirectory` at startup, else 503 `service_unavailable` in the standard error format; both `no-store`
- [X] T024 Implement the app factory `backend/app/main.py`: `create_app(settings: Settings | None = None) -> FastAPI` with `debug=False`, title "Clinic Catalog API", version "1.0.0", `docs_url`/`redoc_url` only when `app_env == "development"`, `openapi_url="/openapi.json"`; call `configure_logging`; register exception handlers; include `health` router at root and an `APIRouter(prefix="/api/v1")` for catalog routers (added per story); add middleware so the order from outermost is RequestID → AccessLog → SecurityHeaders(hsts = app_env=="production") → CORSMiddleware(`allow_origins=settings.cors_origins`, `allow_methods=["GET"]`, `allow_headers=["If-None-Match","X-Request-ID"]`, `expose_headers=["ETag","X-Request-ID","Retry-After"]`, `allow_credentials=False`) (remember Starlette applies `add_middleware` last-added-outermost); store settings on `app.state.settings`; module-level `app = create_app()`

### Test harness

- [X] T025 Implement `backend/tests/conftest.py`: `settings_factory` fixture building `Settings` from explicit kwargs (fake URLs, no `.env` read: `_env_file=None`); `test_db_url` fixture that skips with "TEST_DATABASE_URL not set" when missing and fails if it equals `DATABASE_URL`/`DIRECT_DATABASE_URL`; session-scoped `migrated_engine` (runs `alembic -x target=test downgrade base` then `upgrade head` via `alembic.command`, yields an engine from `make_engine(test url)`); session-scoped `seeded` (runs `app.seed.loader.run_seed(engine)` once); function-scoped `db_session` wrapping each test in a connection-level transaction with `join_transaction_mode="create_savepoint"` and rollback; `client` fixture = `TestClient(create_app(settings))` with `get_session` overridden to yield `db_session`; `make_client(**overrides)` helper for tests needing different settings (rate limit, CORS)
- [X] T026 [P] Migration test in `backend/tests/migrations/test_migrations.py` (`db`): on the test DB run `downgrade base` → `upgrade head` → `downgrade base` → `upgrade head` without error; then `alembic.command.check` reports no differences between models and migrations; assert the exclusion constraint rejects an overlapping session insert (raw SQL inside a rolled-back transaction)
- [X] T027 [P] App basics test in `backend/tests/api/test_app_basics.py` (no DB): `/health` 200 `{"status":"ok"}` with `no-store`; unknown path → 404 standard body; `POST /health` → 405 `method_not_allowed`; every response has `X-Request-ID` and all security headers from T011; `/docs` is 404 when `app_env="test"` and 200 when `"development"`

### Seed data and loader (used by every story's tests)

- [X] T028 Create `frontend/scripts/export-catalog.mts` (run from `frontend/` with `node scripts/export-catalog.mts`): import `siteConfig`, `departments`, `doctors`, `labTestCategories`, `labTests`, `healthPackages` from `../src/data/*.ts` (they only use `import type`, so Node 24 type stripping runs them); write `../backend/app/seed/data/catalog.json` as `{ "siteConfig": ..., "departments": [...], "doctors": [...], "labTestCategories": [...], "labTests": [...], "healthPackages": [...] }` with 2-space indent and a trailing newline, values unchanged (mock ids included). If a data file turns out to have a runtime alias import, switch that import to a relative path in the script only, not in `src/data`
- [X] T029 Run the export (`cd ..\frontend && node scripts\export-catalog.mts`) and commit the generated `backend/app/seed/data/catalog.json`; check counts: 7 departments, 9 doctors, 9 categories, 26 lab tests, 5 packages
- [X] T030 [P] Create `backend/app/seed/data/extras.json`: `clinicRules` (5 entries with `sortOrder` 1–5 and neutral text: arrive 15 minutes before the appointment; cancel or reschedule at least 2 hours before; after 3 missed appointments without notice, online booking may be paused; follow the preparation instructions for lab tests, such as fasting; for emergencies call the emergency number — do not use online booking), `logo` (`{"key": "brand/logo.svg", "alt": "<name> logo", "width": 160, "height": 40}`), `brandColors` (`{"primary": "#0B2545", "accent": "#14B8A6"}`), `defaultSlotMinutes: 15`
- [X] T031 Implement `backend/app/seed/loader.py`: Pydantic input models mirroring `catalog.json`/`extras.json` (camelCase aliases, `extra="forbid"`); `load_seed_files() -> SeedData`; `validate_seed(data)` checks (raise `SeedError` with a clear message): every `departmentId`/`categoryId`/`relatedDepartmentIds`/`relatedTestSlugs`/`testSlugs` resolves, slugs unique and pattern-valid, schedule `start < end` and no overlap per doctor/day, package price ≤ sum of its tests, time zone valid via `zoneinfo`; `run_seed(engine) -> SeedReport` in **one transaction**: upsert by natural key with `INSERT ... ON CONFLICT DO UPDATE` (`clinic_settings` on `singleton`; departments, doctors, categories, lab tests, packages on `slug`; rules on `sort_order`), setting `is_sample=true`, `is_active=true`, `updated_at=now()`, `sort_order` = position in the mock array (1-based) where the mock has none; image keys derived from mock `src` by stripping a leading `/images/`; mock ids mapped to DB UUIDs only in memory; for each seeded parent replace its schedule rows (`slot_minutes = defaultSlotMinutes`) and link rows (`department_related_test`, `lab_test_related_department`, `health_package_test`) preserving list order; never delete rows that are not in the seed data; return counts per table
- [X] T032 Implement `backend/app/seed/__main__.py`: `python -m app.seed` loads settings, refuses with exit code 2 and the message "Refusing to seed: APP_ENV is production." when `app_env == "production"`, otherwise runs `run_seed(get_engine())` and prints one line of counts per table (no URLs)
- [X] T033 [P] Unit tests in `backend/tests/unit/test_seed_validation.py` (no DB): the committed files load and validate; a copy with a broken `departmentId`, a duplicate slug, an overlapping session, or a package priced above its tests each raise `SeedError` naming the record slug; image key derivation strips `/images/`

**Checkpoint**: `uv run pytest` green (DB tests run if `TEST_DATABASE_URL` is set); `uv run alembic upgrade head` and `uv run python -m app.seed` work on the dev DB; `/health` and `/ready` respond.

**Checkpoint result (2026-10-03)**: 56 tests passed, 0 skipped (DB tests ran on the test database); `ruff check`, `ruff format --check` and `mypy --strict` clean; dev migrated to `0001_catalog`; seed run 3× on dev with identical table counts (1 / 5 / 9 / 7 / 26 / 9 / 27 schedules / 5 / 31 / 49 / 34 link rows); `/health` and `/ready` 200 on a running server; access logs are JSON with no query strings or URLs.

**Deviations recorded during Phase 2**:
- T002: Starlette resolved to 1.7, whose `TestClient` uses `httpx2`; the dev dependency is `httpx2>=2.13,<3` instead of `httpx` (same maintainers, dev-only).
- T013/T024: unexpected exceptions are handled by `UnhandledErrorMiddleware` (in `app/errors.py`), the innermost middleware, not by an `Exception` handler. Starlette runs `Exception` handlers in its outermost middleware, which would skip request-ID and security headers on 500s. Middleware order, outermost first: RequestId → AccessLog → SecurityHeaders → CORS → UnhandledError → routes (US5 adds RateLimit inside CORS).
- T019/T020: the schedule's `doctor_id` has no separate index; the unique `(doctor_id, weekday, start_time)` constraint covers it. Constraint/index names come from a metadata naming convention.
- T022: the migration was autogenerated against the empty test database, then edited (plain `sa.String`, `btree_gist`, exclusion constraint); file `migrations/versions/0001_catalog.py`.
- T023: `/ready` takes the engine through the `get_engine` dependency so tests can override it.
- T024: `app.main.app` is created lazily (module `__getattr__`), so importing `app.main` never reads configuration.
- T028: the exporter is `frontend/scripts/export-catalog.mjs` + `catalog-object.mjs` (plain JS, so `tsc` does not need `allowImportingTsExtensions`), run with `npm run export:catalog`. T057 must import `buildCatalog` from `scripts/catalog-object.mjs`.
- T030: the seeded logo key is `brand/logo-mark.svg` (64×64, the existing icon mark). **Follow-up for Feature 004**: publish the mark at `frontend/public/images/brand/logo-mark.svg`.

---

## Phase 3: User Story 1 - Browse doctors and departments (Priority: P1) 🎯 MVP

**Goal**: `GET /api/v1/departments`, `/departments/{slug}`, `/doctors` (filters `department`, `q`, `day`), `/doctors/{slug}` with weekly schedule, matching the frontend `Department` / `Doctor` types.

**Independent Test**: on a seeded test DB, the department and doctor endpoints return all 7 departments and 9 doctors with every frontend field equal to `catalog.json` (except UUID ids/references), filters behave as in spec US1 scenarios 1–7.

### Tests for User Story 1 ⚠️ (write first, expect failures)

- [X] T034 [P] [US1] Create the parity helper `backend/tests/api/parity.py`: `load_catalog()` reads `catalog.json`; `assert_matches_mock(api_item, mock_item, *, id_fields, ref_resolvers, additive)` compares every key of the mock item to the API item except `id` and listed reference fields (checked via resolvers that map UUID → slug), and asserts additive keys exist; used by all parity tests
- [X] T035 [P] [US1] API tests in `backend/tests/api/test_departments.py` (`db`): list returns 7 in mock order with `total=7`; each item matches the mock via the parity helper (`relatedTestSlugs` equal); detail by slug matches; unknown slug → 404 `not_found`; bad slug `Bad_Slug` → 422 naming `slug`; `pageSize=2&page=2` paging and `page=99` → empty items with `total=7`; `pageSize=101` → 422 naming `pageSize`; an inactive department (set `is_active=false` in the test transaction) disappears from list and detail; 200 has `ETag` and `Cache-Control: public, max-age=300`; repeating with `If-None-Match` → 304
- [X] T036 [P] [US1] API tests in `backend/tests/api/test_doctors.py` (`db`): list returns 9 matching mocks (`departmentId` resolves to the mock's department slug; `schedule` equals mock sessions plus `slotMinutes: 15`); `department=cardiology` → only cardiology doctors; `department=unknown` → empty page, 200; `q=HASSAN` → Dr. Hassan Mirza only; `q=%` and `q=_` → treated literally (0 results, 200); `q` of 61 chars → 422; `day=fri` → exactly the doctors with a Friday session in the mocks; `day=funday` → 422; detail `dr-hassan-mirza` matches mock incl. schedule ordered mon→sun then start; inactive doctor and doctor of an inactive department are hidden; unknown slug → 404
- [X] T037 [P] [US1] Unit tests in `backend/tests/unit/test_search.py` for `escape_like`: `%`, `_` and `\` are escaped; normal text unchanged; result wrapped as `%term%`

### Implementation for User Story 1

- [X] T038 [US1] Implement `backend/app/repositories/_common.py`: `escape_like(term: str) -> str` (escape `\`, `%`, `_`; wrap in `%`), `paginate(stmt, page, page_size) -> tuple[Sequence[Row], int]` running a `COUNT(*)` over the same filtered subquery plus `LIMIT/OFFSET`, and `WEEKDAY_ORDER` mapping `mon..sun` → 1..7
- [X] T039 [US1] Add `Department`, `ScheduleSession` (`day`, `start`, `end` as `"HH:MM"`, `slot_minutes`), and `Doctor` response models to `backend/app/schemas.py` with fields exactly as in `contracts/openapi.yaml` (camelCase via alias); `ScheduleSession` serialises `time` to `"HH:MM"`
- [X] T040 [US1] Implement `backend/app/repositories/departments.py`: `list_departments(session, page, page_size) -> tuple[list[DepartmentRow], int]` (active only, order `sort_order, name, id`) and `get_department(session, slug) -> DepartmentRow | None`; fetch `relatedTestSlugs` for the returned departments in **one** query (join `department_related_test` → active `lab_test`, ordered by link `sort_order`) — no per-row queries
- [X] T041 [US1] Implement `backend/app/repositories/doctors.py`: `list_doctors(session, page, page_size, department: str | None, q: str | None, day: str | None)` (active doctor AND active department; `department` filters by department slug; `q` → `full_name ILIKE :q ESCAPE '\'`; `day` → `EXISTS` on schedule; order `sort_order, full_name, id`) and `get_doctor(session, slug)`; load schedules for all returned doctors in one query ordered by weekday order then `start_time`
- [X] T042 [US1] Implement `backend/app/routers/departments.py` (`GET /departments`, `GET /departments/{slug}`) and `backend/app/routers/doctors.py` (`GET /doctors`, `GET /doctors/{slug}`): use `params.py` types, map rows to schemas (images via `image_asset(..., settings.image_base_path)`), raise `NotFound("Department")` / `NotFound("Doctor")`, return via `http_cache.respond(request, model, settings.cache_max_age_seconds)`; declare `responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}}`
- [X] T043 [US1] Register both routers under the `/api/v1` router in `backend/app/main.py`; run `uv run pytest tests/api/test_departments.py tests/api/test_doctors.py tests/unit/test_search.py` and make them pass; `ruff` and `mypy` clean

**Checkpoint**: US1 independently functional and testable — MVP.

---

## Phase 4: User Story 2 - Browse lab tests and health packages (Priority: P1)

**Goal**: `GET /api/v1/lab-test-categories`, `/lab-tests` (`q`, `category`), `/lab-tests/{slug}`, `/health-packages`, `/health-packages/{slug}` (with included `tests` summary).

**Independent Test**: on a seeded test DB, 9 categories, 26 tests and 5 packages match the mocks field by field; search and category filters behave as in spec US2 scenarios 1–5.

### Tests for User Story 2 ⚠️

- [X] T044 [P] [US2] API tests in `backend/tests/api/test_lab_tests.py` (`db`): categories list = 9 in mock order matching mocks; `lab-tests?pageSize=100` → 26 items matching mocks (`categoryId` resolves to mock category, `relatedDepartmentIds` resolve to mock department slugs in order); default page size returns 20 with `total=26`; `q=hba1c` finds the HbA1c test; searching one `alsoKnownAs` value (take the first non-empty from `catalog.json`) finds its test; `category=thyroid` → only thyroid tests; `category=nope` → empty 200; detail by slug matches; unknown → 404; inactive test hidden
- [X] T045 [P] [US2] API tests in `backend/tests/api/test_health_packages.py` (`db`): list = 5 matching mocks (`testSlugs` in mock order); detail has `tests` with the same order as `testSlugs`, each `{id, slug, name, pricePkr, homeCollection}` equal to the lab test; no sum/saving fields present; making one included test inactive removes it from `testSlugs` and `tests` while `packagePricePkr` is unchanged; unknown slug → 404

### Implementation for User Story 2

- [X] T046 [US2] Add `LabTestCategory`, `LabTest`, `LabTestSummary`, `HealthPackage`, `HealthPackageDetail` response models to `backend/app/schemas.py` per `contracts/openapi.yaml`
- [X] T047 [P] [US2] Implement `backend/app/repositories/lab_tests.py`: `list_categories(session, page, page_size)` (order `sort_order, name, id`); `list_lab_tests(session, page, page_size, q, category)` (active only; `q` matches `name ILIKE` OR `EXISTS (SELECT 1 FROM unnest(also_known_as) a WHERE a ILIKE :q ESCAPE '\')`; `category` by category slug; order category `sort_order`, test `sort_order`, `name`, `id`); `get_lab_test(session, slug)`; batch-load `relatedDepartmentIds` (active departments only, link order) in one query
- [X] T048 [P] [US2] Implement `backend/app/repositories/packages.py`: `list_packages(session, page, page_size)`, `get_package(session, slug)`; batch-load included active tests in link order in one query (slugs for list items; summaries for detail)
- [X] T049 [US2] Implement `backend/app/routers/lab_tests.py` (`GET /lab-test-categories`, `GET /lab-tests`, `GET /lab-tests/{slug}`) and `backend/app/routers/packages.py` (`GET /health-packages`, `GET /health-packages/{slug}`) following the T042 pattern; register both in `backend/app/main.py`; make T044–T045 pass; `ruff`/`mypy` clean

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Read white-label clinic settings and rules (Priority: P2)

**Goal**: `GET /api/v1/clinic` and `GET /api/v1/clinic/rules` served only from the database; no clinic value in backend code.

**Independent Test**: change the clinic name and one rule in the test DB transaction → the endpoints return the new values without code change; `/clinic` on an empty `clinic_settings` → 503 `not_configured`.

### Tests for User Story 3 ⚠️

- [X] T050 [P] [US3] API tests in `backend/tests/api/test_clinic.py` (`db`): `/clinic` equals `catalog.json` `siteConfig` for every mock key, plus `logo` (`ImageAsset` with `src` = `IMAGE_BASE_PATH` + key) and `brandColors` from `extras.json`; `demoNotice` equals exactly "Portfolio demo — not a real clinic, not medical advice."; `credit.href` equals "https://github.com/Shuaibali0786"; updating `name` in the transaction changes the response and the `ETag`; deleting the settings row → 503 `not_configured`; `/clinic/rules` returns the 5 active rules in `sortOrder`, an inactive rule disappears, `isSample` true
- [X] T051 [P] [US3] White-label guard in `backend/tests/unit/test_white_label.py`: scan every `*.py` file under `backend/app/` (excluding `backend/app/seed/data/`) and fail if it contains any of: the `siteConfig.name` value, either phone `tel` value, any address line, `Asia/Karachi`, `Karachi`, `#0B2545`, `#14B8A6` (values read from `catalog.json`/`extras.json`, so the test itself is white-label too)

### Implementation for User Story 3

- [X] T052 [US3] Add `PhoneNumber`, `OpeningHoursRule`, `MapArea`, `Credit`, `BrandColors`, `ClinicSettings`, `ClinicRule` response models to `backend/app/schemas.py` per `contracts/openapi.yaml` (`timeZone` as `str`; weekday lists typed with `Weekday`)
- [X] T053 [US3] Implement `backend/app/repositories/clinic.py`: `get_clinic_settings(session) -> ClinicSettingsRow | None`, `list_rules(session, page, page_size)` (active only, order `sort_order, id`)
- [X] T054 [US3] Implement `backend/app/routers/clinic.py` (`GET /clinic` → `ClinicNotConfigured` when no row; `GET /clinic/rules`), map JSONB values through the Pydantic models (invalid stored JSON → logged and 500 `internal_error`, never partial data); register in `backend/app/main.py`; make T050–T051 pass

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Load sample data safely and repeatedly (Priority: P2)

**Goal**: the seed is idempotent, refuses production, and is provably identical to the frontend mocks.

**Independent Test**: run the seed 3× on the test DB → identical counts and identical API output (ETags equal) each time; `APP_ENV=production` → refused, no change; frontend parity test passes.

### Tests for User Story 4 ⚠️

- [ ] T055 [P] [US4] DB tests in `backend/tests/api/test_seed_idempotency.py` (`db`): on a freshly migrated test DB run `run_seed` 3×; after each run table counts equal (1, 5, 7, 9, 9, 26, 5 and the expected schedule and link row counts computed from `catalog.json`) and the set of `(slug, id)` pairs is unchanged; modify a sample price, re-run → restored to the mock value; insert an extra non-sample department, re-run → it still exists; `/api/v1/doctors` `ETag` identical across runs
- [ ] T056 [P] [US4] Unit test in `backend/tests/unit/test_seed_cli.py`: invoking `app.seed.__main__.main()` with settings `app_env="production"` exits with code 2, prints the refusal message, and never calls `run_seed` (monkeypatch); output never contains a URL
- [ ] T057 [P] [US4] Frontend parity test `frontend/tests/unit/catalog-export.test.ts` (Vitest): build the same object as `scripts/export-catalog.mts` from `@/data/*` and `expect` it to deep-equal `JSON.parse` of `../backend/app/seed/data/catalog.json`; failure message tells the developer to run `node scripts\export-catalog.mts`. Factor the object-building into `frontend/scripts/catalog-object.mts` (or export a function from the script) so script and test share it; run `npm test -- catalog-export` from `frontend/`

### Implementation for User Story 4

- [ ] T058 [US4] Fix any gaps the T055–T057 tests expose in `backend/app/seed/loader.py` / `backend/app/seed/__main__.py` / `frontend/scripts/export-catalog.mts`; then run `uv run python -m app.seed` three times against the **dev** DB and record the printed counts in the PR description (no URLs)

**Checkpoint**: seed guarantees proven.

---

## Phase 7: User Story 5 - Operate the backend safely (Priority: P2)

**Goal**: per-IP rate limiting, strict CORS, readiness behaviour, safe 500s, and logs proven free of secrets and query strings.

**Independent Test**: exceed the limit → 429 + `Retry-After`; disallowed origin → no CORS headers; DB down → `/ready` 503 without details; forced error → generic 500; captured logs contain no URL, password or query string.

### Tests for User Story 5 ⚠️

- [ ] T059 [P] [US5] Unit tests in `backend/tests/unit/test_rate_limit.py` using an injected fake clock: N allowed requests per window then blocked with `retry_after` = seconds to window end (≥ 1); new window resets; separate IPs are independent; eviction removes expired windows; `client_ip()` uses `scope["client"]` when `trusted_proxy_hops=0` even if `X-Forwarded-For` is present, and the correct hop from the right when `trusted_proxy_hops=1`/`2`; malformed header falls back to the socket address
- [ ] T060 [P] [US5] API tests in `backend/tests/api/test_rate_limit_api.py` (no DB: use `/api/v1/departments` with `get_session` overridden to a stub that is never reached, or a test-only route): with `rate_limit_per_minute=3` the 4th request → 429 `rate_limited` with integer `Retry-After` and `X-Request-ID`; `/health` is never limited; 429 bodies have `no-store`
- [ ] T061 [P] [US5] API tests in `backend/tests/api/test_cors.py` (no DB, `/health`): allowed origin gets `Access-Control-Allow-Origin` equal to it and no `Access-Control-Allow-Credentials`; disallowed origin gets no `Access-Control-Allow-*` headers; preflight `OPTIONS` with `Access-Control-Request-Method: POST` from an allowed origin is not granted `POST`
- [ ] T062 [P] [US5] API tests in `backend/tests/api/test_failures.py`: (a) `/ready` with `get_engine` overridden to an engine pointing at an unreachable host (`postgresql+psycopg://u:p@127.0.0.1:1/db?sslmode=require`, `connect_timeout=1`) → 503 `service_unavailable`, body contains no host, port, user or "psycopg"; (b) a catalog route whose repository is monkeypatched to raise `RuntimeError("secret detail")` → 500 `internal_error`, body lacks "secret detail" and "Traceback"; (c) `/ready` 503 when `alembic_version` differs from head (`db`)
- [ ] T063 [P] [US5] Log-safety test in `backend/tests/api/test_log_safety.py`: with `caplog` capturing JSON-formatted records, send requests with query strings (`?q=private-text&pageSize=5`), trigger a 500 whose exception message contains a fake postgres URL with password `SECRETPW`; assert no captured line contains `private-text`, `SECRETPW`, `postgresql://u:` or `?`, and every access record has `requestId`, `method`, `path`, `status`, `durationMs`

### Implementation for User Story 5

- [ ] T064 [US5] Implement `backend/app/middleware/rate_limit.py`: `RateLimiter` `Protocol` with `hit(key: str, now: float) -> int | None` (returns retry-after seconds when blocked); `InMemoryFixedWindowLimiter(limit_per_minute)` (dict `key → (window_start, count)`, `threading.Lock`, evicts expired windows at most every 60 s); `client_ip(scope, trusted_proxy_hops) -> str`; pure ASGI `RateLimitMiddleware(app, limiter, trusted_proxy_hops, exempt_paths={"/health"}, clock=time.monotonic)` that on block sends the standard 429 body via `errors.error_response` content with `Retry-After`
- [ ] T065 [US5] Wire `RateLimitMiddleware` into `backend/app/main.py` innermost of the middleware stack (inside CORS, so 429s still carry CORS and security headers), using `settings.rate_limit_per_minute` and `settings.trusted_proxy_hops`; make T059–T063 pass; `ruff`/`mypy` clean

**Checkpoint**: all five stories functional; security baseline proven by tests.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Contract diff test `backend/tests/unit/test_openapi_contract.py`: load `specs/003-catalog-api/contracts/openapi.yaml` (parse with `json`-compatible YAML subset loader: add `pyyaml` to the **dev** group only, justify in the PR) and the app's `app.openapi()`; assert the same set of `(path, method)` pairs under `/api/v1`, `/health`, `/ready`, and that each contract schema's `required` property names exist in the generated response schema (by alias). Fix code or contract until they agree
- [ ] T067 [P] Performance check `backend/tests/perf/test_latency.py` (`perf`, `db`): seed, warm up 5 requests, then 50 requests each to `/api/v1/departments`, `/doctors`, `/doctors?department=cardiology`, `/lab-tests`, `/lab-tests?q=test`, `/health-packages`, `/doctors/dr-hassan-mirza`; measure server time from the access-log `durationMs` (capture via a logging handler); assert p95 < 200 ms per endpoint and print a small table; run with `uv run pytest -m perf`
- [ ] T068 [P] Honesty test `backend/tests/api/test_honesty.py` (`db`): every item from every catalog list endpoint (all pages) has `isSample: true`; `/clinic` `isSample` true and `demoNotice` equals the constitution text
- [ ] T069 Write `backend/README.md` from `specs/003-catalog-api/quickstart.md` (Windows CMD: install, configure, migrate, seed, run, test, regenerate seed data, troubleshooting: "app refuses to start" messages, Neon idle wake-up delay); add a short root `README.md` linking `backend/README.md`, the constitution and the specs folder (constitution Sync Impact Report follow-up)
- [ ] T070 Run the full gate from `backend/`: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy app`, `uv run pytest` (with `TEST_DATABASE_URL` set: 0 skipped DB tests), `uv run pytest -m perf`; from `frontend/`: `npm test`, `npm run lint`, `npm run typecheck`. Fix every failure
- [ ] T071 Walk through every checkbox in `specs/003-catalog-api/quickstart.md` "Acceptance walk-through" against the dev DB with the server running (`uv run uvicorn app.main:app --port 8000 --no-access-log`) and record results in the PR description; run `git status` and `git diff --cached` to confirm no `.env`, no real URL and no `.venv` is staged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; **blocks all stories**. Internal order: T005 → (T006, T007) → T008–T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → (T026, T027) and T028 → T029 → (T030) → T031 → T032 → T033.
- **US1 (Phase 3)**, **US2 (Phase 4)**, **US3 (Phase 5)**: each depends only on Phase 2; independent of each other except that they append to the same `backend/app/schemas.py` and `backend/app/main.py` (do those edits sequentially).
- **US4 (Phase 6)**: depends on Phase 2; T055's `ETag` check uses the `/doctors` route from US1.
- **US5 (Phase 7)**: depends on Phase 2; T060 uses the `/departments` route from US1 (or a test-only route if US1 is not done).
- **Polish (Phase 8)**: after all stories.

### Within Each Story

Tests first (they fail with 404/ImportError) → schemas → repositories → routers → register in `main.py` → tests pass → `ruff` + `mypy` clean.

### Parallel Opportunities

- Phase 1: T003, T004 in parallel after T002.
- Phase 2: T006 ∥ T007; then T008, T009, T010, T011, T014, T017, T018 in parallel (different files); T026 ∥ T027; T030 ∥ T028–T029; T033 after T031.
- US1: T034–T037 in parallel; then T040 ∥ T041 after T038–T039.
- US2: T044 ∥ T045; T047 ∥ T048 after T046.
- US3: T050 ∥ T051.
- US4: T055 ∥ T056 ∥ T057.
- US5: T059–T063 in parallel.
- Polish: T066 ∥ T067 ∥ T068.
- After Phase 2, US1, US2 and US3 can be built in parallel by different people if `schemas.py`/`main.py` edits are serialised.

---

## Parallel Example: User Story 1

```text
Task: "T034 Parity helper in backend/tests/api/parity.py"
Task: "T035 Department API tests in backend/tests/api/test_departments.py"
Task: "T036 Doctor API tests in backend/tests/api/test_doctors.py"
Task: "T037 escape_like unit tests in backend/tests/unit/test_search.py"

# then, after T038 and T039:
Task: "T040 Department repository in backend/app/repositories/departments.py"
Task: "T041 Doctor repository in backend/app/repositories/doctors.py"
```

## Parallel Example: User Story 5

```text
Task: "T059 Rate limiter unit tests in backend/tests/unit/test_rate_limit.py"
Task: "T060 Rate limit API tests in backend/tests/api/test_rate_limit_api.py"
Task: "T061 CORS tests in backend/tests/api/test_cors.py"
Task: "T062 Failure-mode tests in backend/tests/api/test_failures.py"
Task: "T063 Log-safety test in backend/tests/api/test_log_safety.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational (needs the Neon dev URLs and a test DB URL in `backend/.env`).
2. Phase 3 US1 → **stop and validate**: doctors and departments served from Postgres, matching the mocks, with errors, ETags and security headers.

### Incremental Delivery

1. Setup + Foundational → API skeleton, schema, seed.
2. US1 → doctors/departments (MVP).
3. US2 → lab tests/packages.
4. US3 → clinic settings/rules (white-label proven).
5. US4 → seed guarantees.
6. US5 → rate limit, CORS, failure modes, log safety.
7. Polish → contract diff, perf, docs, full gate.

Commit after each task or logical group; one concern per commit (Constitution IX).

---

## Notes

- `[P]` = different files, no dependency on unfinished tasks.
- The user must provide `DATABASE_URL`, `DIRECT_DATABASE_URL` and `TEST_DATABASE_URL` in `backend/.env` before T022's migration can be applied and before DB tests run; never paste them into chat or commit them.
- If `node scripts/export-catalog.mts` fails because a data file has a runtime import, fix it in the script (T028), not in `frontend/src/data`.
- `pyyaml` (T066) is a dev-only dependency; if rejected, convert `openapi.yaml` to `openapi.json` in the contracts folder instead and load it with `json`.
