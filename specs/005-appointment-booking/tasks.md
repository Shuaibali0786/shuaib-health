---
description: "Task list for Feature 005 — Doctor schedules, available time slots and online appointment booking"
---

# Tasks: Doctor Schedules, Available Time Slots and Online Appointment Booking

**Input**: Design documents from `/specs/005-appointment-booking/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md), [ADR-0005](../../history/adr/0005-booking-integrity-db-enforcement.md), [ADR-0006](../../history/adr/0006-proxy-trust-and-postgres-rate-limiting.md)

**Tests**: REQUIRED by spec FR-081, FR-082 and constitution IX. Write each test task before the code it covers, and see it fail first.

**Paths**: every path starts with `backend/`, `frontend/`, `specs/` or `history/`.
- Backend commands run from `backend/`, with `uv run …`.
- Frontend commands run from `frontend/`, in Windows CMD.

**Before writing Next.js code**: read the relevant guide in `frontend/node_modules/next/dist/docs/` (per `frontend/AGENTS.md`), in particular:
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/03-api-reference/03-file-conventions/route.md`
- `01-app/03-api-reference/03-file-conventions/instrumentation.md`
- `01-app/03-api-reference/04-functions/use-search-params.md`
- metadata `robots` / `referrer`

**Constitution phase (Principle X)**: every task belongs to **Phase 2 — Backend**. No task references staff app, deploy or chatbot deliverables.

**Checkpoints**: each phase ends with a **CHECKPOINT**. Run the listed commands, then stop and report to the user (what changed, results, anything surprising) before starting the next phase.

**Database tests**: tests marked `db` need `TEST_DATABASE_URL` (never the dev or prod database). Concurrency and retention tests use the `committing_engine` fixture (T024), which commits for real and cleans up after itself.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[USn]**: user story from spec.md:

  | Label | Story | Priority |
  |---|---|---|
  | US1 | book in under a minute | P1, MVP |
  | US2 | no double-booking | P1 |
  | US3 | safe retries | P1 |
  | US4 | real slots | P1 |
  | US5 | Book from a doctor page | P2 |
  | US6 | abuse protection | P2 |
  | US7 | privacy, honesty and retention | P2 |

**Story order**: US4 comes first because every other story needs slots. Then US1 → US2 → US3 → US6 → US7 → US5.

---

## Phase 1: Setup, Baseline & Contract

**Purpose**: record today's state, then agree the API contract before any code.

- [X] T001 Record the backend baseline.
  - Run `uv run ruff check .`, `uv run mypy` and `uv run pytest`.
  - Write pass counts and durations to `specs/005-appointment-booking/results.md`, section "Baseline — backend" (create the file).
- [X] T002 [P] Record the frontend baseline.
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:e2e:stateful` and `npm run test:e2e:offline`.
  - Write the results to `specs/005-appointment-booking/results.md`, section "Baseline — frontend".
- [X] T003 [P] Record the Lighthouse baseline.
  - Mobile preset, 3 runs, median, against `npm run build && npm run start`, for `/book-appointment` and `/doctors/dr-ayesha-rahman`.
  - Record performance score, LCP, TBT, CLS and JS kB in `specs/005-appointment-booking/results.md`, section "Baseline — Lighthouse".
- [X] T004 Merge `specs/005-appointment-booking/contracts/booking-api.openapi.yaml` into `specs/003-catalog-api/contracts/openapi.yaml`.
  - Add the three paths: `/api/v1/doctors/{slug}/slots`, `/api/v1/appointments`, `/api/v1/appointments/{reference}`.
  - Add the schemas `Slot`, `AlternativeSlot`, `SlotDay`, `DoctorSlots`, `AppointmentCreate`, `AppointmentView`, `BookingConflict`.
  - Add a new `ErrorInfo` schema whose properties equal the existing `Error.error` object (`code`, `message`, `requestId`, `details`). Point `BookingConflict.error` at `#/components/schemas/ErrorInfo` instead of a nested-property `$ref`.
  - Set `info.version` to `1.1.0` and append the booking paragraph from the delta's `info.description`.
- [X] T005 Edit `backend/tests/unit/test_openapi_contract.py` for the new contract.
  - Add a module constant `PENDING_BOOKING_OPERATIONS = {("/api/v1/doctors/{slug}/slots","get"), ("/api/v1/appointments","post"), ("/api/v1/appointments/{reference}","get")}`.
  - In `test_same_paths_and_methods` and the other operation loops, compare `operations(contract) - PENDING_BOOKING_OPERATIONS` with the generated operations.
  - Add a comment: "remove entries as routes land (T038, T058)".
  - Add `Slot`, `SlotDay`, `DoctorSlots`, `AppointmentView` to the expected-schemas tuple, but leave them commented until T038/T058.
  - Run `uv run pytest tests/unit/test_openapi_contract.py`. It must be green.
- [X] T006 Regenerate the frontend API types and add zod schemas for the new shapes.
  - Run `npm run api:types`, regenerating `frontend/src/lib/api/schema.gen.ts`.
  - Create `frontend/src/lib/booking/schemas.ts` with zod 4 schemas `SlotSchema`, `AlternativeSlotSchema`, `SlotDaySchema`, `DoctorSlotsSchema`, `AppointmentViewSchema`, `ErrorInfoSchema`, `BookingConflictSchema` (unknown keys stripped; instants validated with `z.iso.datetime()`; `localTime` with `^([01]\d|2[0-3]):[0-5]\d$`).
  - Export the inferred types.
- [X] T007 [P] Extend the existing drift tests (helper `frontend/tests/unit/helpers/api-contract.ts`) to the new schemas.
  - Files: `frontend/tests/unit/api-contract.test.ts` and `frontend/tests/unit/api-contract-drift.test.ts`.
  - Every property of `DoctorSlots`, `SlotDay`, `Slot`, `AppointmentView` and `BookingConflict` in the contract must exist in the zod schema with a compatible type.
  - Injected drifts (removed field, renamed field, changed type, newly required field) must each fail.

**CHECKPOINT 1**: baselines recorded; contract v1.1.0 parses; backend contract test green with the pending set; `npm run typecheck` and `npm test` green.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: schema and migration, settings with fail-fast, privacy and time helpers, trusted client IP, seed with a break, the website proxy module, and mock API booking support.

### 2a. Backend settings, schema, migration

- [ ] T008 Add the new settings to `backend/app/settings.py`.

  | Setting | Type | Default | Rule |
  |---|---|---|---|
  | `booking_proxy_secret` | `SecretStr` | required | at least 32 characters |
  | `privacy_hash_key` | `SecretStr` | required | at least 32 characters |
  | `demo_mode` | `bool` | `True` | |
  | `booking_purge_after_days` | `int` | 7 | 1–90 |
  | `booking_limit_per_ip_per_hour` | `int` | 10 | 1–1000 |
  | `booking_limit_per_phone_per_day` | `int` | 5 | 1–100 |
  | `lookup_limit_per_ip_per_minute` | `int` | 20 | 1–1000 |
  | `audit_purge_after_days` | `int` | 90 | 7–365 |

  - A field validator must raise `ValueError("BOOKING_PROXY_SECRET is required (at least 32 characters)")` (and the same wording for `PRIVACY_HASH_KEY`). The value is never echoed; `hide_input_in_errors` is already on.
- [ ] T009 [P] Update `backend/.env.example`.
  - Add `BOOKING_PROXY_SECRET=` and `PRIVACY_HASH_KEY=` with the comment "required, ≥ 32 chars, generate with python -c \"import secrets; print(secrets.token_urlsafe(32))\"; the app refuses to start without them".
  - Add `DEMO_MODE=true`, `BOOKING_PURGE_AFTER_DAYS=7`, `AUDIT_PURGE_AFTER_DAYS=90` and the three limit settings with their defaults.
- [ ] T010 Update the test settings and add the fail-fast tests.
  - In `backend/tests/conftest.py`, `settings_factory` gets fake values `booking_proxy_secret="test-proxy-secret-0123456789abcdef"` and `privacy_hash_key="test-privacy-key-0123456789abcdefgh"`.
  - Add to `backend/tests/unit/test_settings.py`:
    - a missing or 31-character proxy secret raises `ValidationError` whose text names `BOOKING_PROXY_SECRET` and does not contain the value;
    - the same for `PRIVACY_HASH_KEY`;
    - `create_app()` with the setting missing raises before serving;
    - `python -m app.seed` with it missing exits non-zero (subprocess, with an env without the setting).
  - In the `test_engine` fixture, replace the generic skip reason with one that names the failing settings: `pytest.skip(f"backend settings invalid: {', '.join(e['loc'][0] for e in exc.errors())}")`. That way, missing new secrets in `backend/.env` can't silently look like "TEST_DATABASE_URL not set".
  - Add both secrets to the "Prerequisites" table in `specs/005-appointment-booking/quickstart.md` (already listed) and to `backend/README.md` setup.
- [ ] T011 Add a UTC helper and its test.
  - In `backend/app/booking/__init__.py` (empty package marker), and `backend/app/booking/timeutil.py`: `UTC = timezone.utc`, `to_utc(dt)`, which raises `ValueError` on naive input and otherwise returns `dt.astimezone(UTC)`, and `utc_iso(dt)`, which formats as `YYYY-MM-DDTHH:MM:SSZ`.
  - Unit test in `backend/tests/unit/test_timeutil.py`.
- [ ] T012 Add the new models and columns to `backend/app/models.py`, as specified in `data-model.md` §1 and §3–§8.
  - New models: `DoctorLeave`, `ClinicHoliday`, `Appointment`, `IdempotencyKey`, `RateLimitCounter`, `AuditLog`.
  - `ClinicSettings` gains `booking_window_days`, `booking_lead_minutes`, `max_active_bookings_per_phone`, with server defaults 14, 120 and 3 and CHECKs.
  - All instants use `DateTime(timezone=True)`.
  - Extend the module docstring: "the no-overlap exclusion constraint on `appointment` exists only in migration 0002 (ADR-0005)".
- [ ] T013 Create `backend/migrations/versions/0002_booking.py` (`revision="0002_booking"`, `down_revision="0001_catalog"`).
  - **upgrade**: the three `clinic_settings` columns; the six tables with every CHECK, FK and index from data-model.md, including `ix_appointment_patient_phone_active` (partial) and an index on `appointment(ends_at)`.
  - Add the exclusion constraint with `op.execute("ALTER TABLE appointment ADD CONSTRAINT ex_appointment_no_overlap EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')")`.
  - **downgrade**: drop everything in reverse order.
- [ ] T014 Add migration tests to `backend/tests/migrations/test_migrations.py` (db).
  - `0002` upgrades and downgrades cleanly, and `alembic check` passes after upgrade.
  - `pg_constraint` contains `ex_appointment_no_overlap`.
  - Raw SQL inserts of two confirmed overlapping appointments for one doctor fail with SQLSTATE `23P01`.
  - Back-to-back slots (`10:00–10:15`, `10:15–10:30`) both insert.
  - An overlapping `cancelled` row inserts.
  - With `SET TIME ZONE 'Asia/Tokyo'` on the session, a stored and re-read instant is unchanged after `to_utc` (research R5).

### 2b. Backend cross-cutting helpers

- [ ] T015 [P] Add the clock dependency and its test.
  - `backend/app/booking/clock.py`: a `Clock` protocol (`now() -> datetime`, aware UTC), `SystemClock`, `get_clock` FastAPI dependency, and `ClockDep`.
  - `backend/tests/conftest.py` gets a `frozen_clock` fixture plus a helper to override `get_clock` on an app.
- [ ] T016 [P] Add the privacy hashes and their test.
  - `backend/app/booking/privacy.py`:
    - `hmac_hex(key: SecretStr, namespace: str, value: str, length: int = 32) -> str` (HMAC-SHA256, hex, truncated);
    - `fingerprint(key, ip) -> str` (16 hex);
    - `request_hash(payload: Mapping[str, str | None]) -> str` (SHA-256 of canonical JSON, sorted keys).
  - Unit test in `backend/tests/unit/test_privacy.py`: deterministic, namespace-separated, does not contain the input.
- [ ] T017 [P] Add the booking error types.
  - In `backend/app/errors.py`:
    - `BookingConflict(code: Literal["slot_taken","slot_unavailable","booking_limit_reached","idempotency_key_reused"], message: str, alternatives: list[AlternativeSlot] | None)` → `409`, with body `{"error": {...}, "alternatives": [...]}` (omit alternatives when None);
    - `Forbidden` → `403` `forbidden`;
    - `RequestRejected` → `400` `request_rejected` ("We couldn't process this booking. Please call the clinic.").
  - Register them in `register_exception_handlers`.
  - Unit tests in `backend/tests/unit/test_errors.py`.
- [ ] T018 Honour `X-Client-IP` only with a valid proxy secret.
  - Change `client_ip()` in `backend/app/middleware/rate_limit.py` to `client_ip(scope, trusted_proxy_hops, proxy_secret: str | None = None)`. When the `x-proxy-secret` header matches `proxy_secret` (`hmac.compare_digest`) and `x-client-ip` parses with `ipaddress.ip_address`, return it; otherwise use the current behaviour.
  - Pass the secret to `RateLimitMiddleware` in `backend/app/main.py` (constructor argument `proxy_secret`).
  - Add a reusable `get_client_ip(request)` dependency in `backend/app/deps.py`.
  - Tests in `backend/tests/unit/test_client_ip.py`: secret valid → header IP; wrong or missing secret → socket IP; invalid IP → socket; existing hop behaviour unchanged.
- [ ] T019 [P] Add a `require_proxy_secret` dependency (research R4; Principle VI applied per layer).
  - `backend/app/deps.py`: raises `Forbidden` when the request has an `Origin` header that is not in `settings.cors_origins`, **or** when `X-Proxy-Secret` does not match (constant time).
  - A missing `Origin` is accepted only together with a valid secret (server-to-server).
  - Unit test in `backend/tests/unit/test_deps.py`: valid secret with no Origin → ok; valid secret with a foreign Origin → 403; valid secret with an allowed Origin → ok; wrong or missing secret → 403.

### 2c. Seed (break, leave, holiday)

- [ ] T020 Add the seeded break (research R11).
  - In `frontend/tests/fixtures/catalog/doctors.ts`, split `dr-omar-sheikh` Tuesday `14:00–20:00` into `14:00–17:00` and `18:00–20:00`.
  - Run `npm run export:catalog` to regenerate `backend/app/seed/data/catalog.json`.
  - Run `npm test`; `catalog-export` and the parity tests must pass.
- [ ] T021 Seed sample leave and holidays.
  - Create `backend/app/seed/data/booking.json`:
    - `{"leave":[{"doctorSlug":"dr-sana-farooqui","dayOffset":2},{"doctorSlug":"dr-hassan-mirza","dayOffset":4,"start":"09:00","end":"11:00"}],"holidays":[{"dayOffset":6,"name":"Clinic closed (sample holiday)"}]}`
    - Choose offsets so each lands in the 14-day window; the loader moves an offset forward to the doctor's next working weekday when needed.
  - Extend `backend/app/seed/loader.py`:
    - pydantic `BookingSeedIn` model, validated in `validate_seed` (doctor slugs exist, `start < end`, offsets 0–13);
    - `_write` replaces all `is_sample` leave and holiday rows;
    - local dates are computed from seed-run "today" in `clinic_settings.time_zone` and converted to UTC ranges;
    - report counts `doctor_leave` and `clinic_holiday`.
  - Keep the production refusal in `backend/app/seed/__main__.py`.
- [ ] T022 Extend the seed tests: `backend/tests/api/test_seed_idempotency.py` (seed twice → same leave/holiday counts, no duplicates) and `backend/tests/unit/test_seed_validation.py` (unknown doctor slug and inverted times rejected with a message naming the record).
- [ ] T023 Re-record the API fixtures and update the snapshots for the new break.
  - Start the seeded backend and run `npm run api:record`, updating `frontend/tests/fixtures/api/doctors.json`.
  - Run `npx playwright test visual-baseline -g "dr-omar-sheikh" --update-snapshots`, updating `frontend/tests/e2e/visual-baseline.spec.ts-snapshots/visual-baseline-doctors-dr-omar-sheikh-*`.
  - Review the image diff: only the Tuesday schedule row may differ. Note it in `specs/005-appointment-booking/results.md`.
- [ ] T024 Add a `committing_engine` fixture to `backend/tests/conftest.py` (session scope, db).
  - Build an engine on `TEST_DATABASE_URL` with `pool_size=25, max_overflow=5`, on the migrated and seeded database.
  - After each test that uses it, run `TRUNCATE appointment, idempotency_key, rate_limit_counter, audit_log`.
  - Add a `make_committing_client(**overrides)` helper that builds an app whose `get_session` opens a real `Session(committing_engine)` per request.

### 2d. Website foundation

- [ ] T025 Add `getProxySecret()` to `frontend/src/lib/api/config.ts`. It returns the trimmed `BOOKING_PROXY_SECRET` when its length is at least 32, else `null`, and never echoes the value. Add a unit test in `frontend/tests/unit/api-config.test.ts`.
- [ ] T026 Add the website fail-fast check in `frontend/src/instrumentation.ts`.
  - `export function register()`: if `process.env.NEXT_RUNTIME === "nodejs"` and `process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD` (import from `next/constants`) and `getProxySecret() === null`:
    - when `NODE_ENV === "production"`, `throw new Error("BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start")`;
    - otherwise `console.error` the same message.
  - Tests in `frontend/tests/unit/instrumentation.test.ts`: production + missing → throws; production + short → throws; production + valid → ok; development → logs only; build phase → no throw.
- [ ] T027 [P] Provide the secret to every test server and document it.
  - Use an obviously fake, low-entropy value so the secret scan doesn't flag it. If gitleaks flags it anyway (T106), add a path-scoped allowlist entry in `.gitleaks.toml` for the Playwright configs and `backend/tests/conftest.py` only, never a global rule.
  - Set `BOOKING_PROXY_SECRET=fake-e2e-proxy-secret-not-real-000000` in the `webServer.env` of `frontend/playwright.config.ts`, `frontend/playwright.stateful.config.ts` and `frontend/playwright.offline.config.ts`.
  - Pass the same value as `MOCK_PROXY_SECRET` to the mock API server.
  - Add `BOOKING_PROXY_SECRET=` to `frontend/.env.example`, with the comment "server-only; must equal backend BOOKING_PROXY_SECRET; `next start` refuses to start without it; the build does not need it".
- [ ] T028 Create `frontend/src/lib/booking/backend.ts` (`import "server-only"`).
  - `callBooking({ method, path, body?, idempotencyKey?, clientIp, requestId, timeoutMs })` → `{ status, body: unknown, retryAfter?: string, requestId?: string }`.
  - Uses `getApiBase()` and `getProxySecret()`. Either one missing → throw `ApiError("unconfigured")`.
  - Sends the headers `X-Proxy-Secret`, `X-Client-IP`, `X-Request-ID` and, when given, `Idempotency-Key`; `cache: "no-store"`; `AbortSignal.timeout(timeoutMs)`.
  - Maps network and timeout failures to `ApiError`.
  - Never logs bodies or headers. On failure it logs only `{ path template, status, code, requestId }`.
  - Export `clientIpFrom(headers: Headers)`: the first valid entry of `x-forwarded-for`, else `x-real-ip`, else `"unknown"`.
- [ ] T029 Add tests for `backend.ts` and update the existing guards.
  - `frontend/tests/unit/booking-backend.test.ts` (mock `fetch`): headers forwarded, timeout → `ApiError("timeout")`, unconfigured secret → `ApiError("unconfigured")`, `console` spies see no body or phone.
  - `frontend/tests/unit/single-fetch.test.ts`: allow exactly `src/lib/api/http.ts` and `src/lib/booking/backend.ts`.
  - `frontend/tests/unit/no-api-url-in-client.test.ts`: also assert the e2e proxy secret string never appears in client bundles.
- [ ] T030 Extend the mock API in `frontend/tests/mock-api/server.mjs` (contracts/website-booking.md §5).
  - `MOCK_NOW` (default `2026-10-05T04:00:00Z`) and `MOCK_PROXY_SECRET`, compared on every booking route; a mismatch returns `403`.
  - `GET /api/v1/doctors/:slug/slots` builds days from `tests/fixtures/api/doctors.json` schedules, using the same rules as data-model §9 with a 2 h lead time and a 14-day window, in Asia/Karachi.
  - `POST /api/v1/appointments` keeps an in-memory store of confirmed slots and of idempotency key → result. It returns `201` (masked view), replays repeated keys, and returns `409 slot_taken` with up to 5 alternatives when the slot is booked.
  - `GET /api/v1/appointments/:reference` returns the view or `404`.
  - New modes: `booking-down`, `booking-slow` (20 s), `slot-taken` (next POST loses), `rate-limited` (`429` with `Retry-After: 60`).
  - `/__log` records method, path and mode for booking routes, never bodies.
  - `POST /__reset` clears the booking store.
- [ ] T031 [P] Extend `frontend/tests/unit/mock-api.test.ts`: slots shape validates with `DoctorSlotsSchema`; book → slot disappears; same key replays the same reference; second key on the same slot → `409` with alternatives; wrong secret → `403`; each new mode behaves; the log holds no body fields.

**CHECKPOINT 2**:
- Backend: `uv run ruff check . && uv run mypy && uv run pytest` green, including the migration up/down, exclusion-violation and fail-fast tests.
- Frontend: `npm run typecheck && npm run lint && npm test` green, and `npm run build` with no env set passes.
- `uv run alembic upgrade head` and `uv run python -m app.seed` work on dev.

---

## Phase 3: User Story 4 — Slots reflect real schedules, leave and holidays (Priority: P1)

**Goal**: the server computes available slots per doctor for the booking window, in clinic time (FR-010–FR-014).

**Independent Test**: with a frozen "now" and fixed data (a schedule with a break, one leave day, one partial leave, one holiday, one booking), `GET /api/v1/doctors/{slug}/slots` matches the expected list exactly. The website route returns the same body.

### Tests for User Story 4 ⚠️

- [ ] T032 [P] [US4] Write the slot-engine table tests in `backend/tests/unit/test_slots.py` (pure, no database). Cover:
  - **Grid and breaks**: Monday 10:00–13:00 and 17:00–20:00 at 15 min give 10:00…12:45 and 17:00…19:45; a session ending 12:50 has its last slot at 12:30.
  - **Time filters**: lead time (now 11:05, lead 120 → first slot ≥ 13:05); past days.
  - **Blocking rules**: whole-day leave gives `doctor_unavailable`; partial leave removes only the overlapping slots; a holiday gives `clinic_closed` plus `holidayName`; a non-working weekday gives `not_working`.
  - **Remaining statuses**: an existing booking removes overlapping slots (including different lengths); all booked gives `fully_booked`; all past gives `no_longer_available`.
  - **Window**: `days > window` is clamped; `from` in the past is clamped to today.
  - **Time zones**: a Karachi day boundary (23:45 local belongs to that date) with the process `TZ=America/New_York` (set via `monkeypatch.setenv` + `time.tzset` where available, otherwise documented skip on Windows). A DST zone (`Europe/London`) skips nonexistent local times and uses `fold=0`.
  - **`next_free`**: returns at most 5 ascending slots after a given instant.
- [ ] T033 [P] [US4] Write API tests in `backend/tests/api/test_slots_api.py` (db, frozen clock).
  - `200` shape validates against the `DoctorSlots` schema; `Cache-Control: no-store`.
  - Unknown or inactive doctor → `404`; doctor in an inactive department → `404`; `days=0`/`days=61`/bad `from` → `422`.
  - A seeded `dr-omar-sheikh` Tuesday has no slot 17:00–17:59.
  - A seeded leave day reports `doctor_unavailable`.
  - The response never contains the leave note or any appointment field.

### Implementation for User Story 4

- [ ] T034 [US4] Implement the pure slot engine in `backend/app/booking/slots.py`.
  - Frozen dataclasses: `SessionRule(weekday, start: time, end: time, slot_minutes)`, `Busy(start: datetime, end: datetime)`, `Holiday(date, name)`, `SlotOut(starts_at, ends_at, local_time)`, `DayOut(date, weekday, status, holiday_name, slots)`.
  - `build_days(*, now, tz: ZoneInfo, window_days, lead_minutes, sessions, leave: list[Busy], holidays, bookings: list[Busy], from_date: date | None, days: int | None) -> list[DayOut]`.
  - `next_free(..., after: datetime, limit: int = 5) -> list[SlotOut]`.
  - `is_available(..., starts_at) -> SlotOut | None`.
  - No I/O and no `datetime.now()`. Follow data-model §9 exactly.
- [ ] T035 [US4] Add the availability queries in `backend/app/repositories/availability.py`.
  - `load_doctor_for_booking(session, slug)`: active doctor with an active department, fee, specialty, department slug and name.
  - `load_sessions(doctor_id)`.
  - `load_leave(doctor_id, start, end)`: overlap query.
  - `load_holidays(start_date, end_date)`.
  - `load_confirmed_bookings(doctor_id, start, end)`.
  - `load_booking_settings(session)`: time zone, window, lead time, max active.
  - Every datetime returned goes through `to_utc`.
- [ ] T036 [US4] Add response models to `backend/app/schemas.py`: `Slot`, `AlternativeSlot`, `SlotDay` (`status` Literal of the 6 values, optional `holiday_name`), `DoctorSlots`. Use camelCase aliases via `CamelModel`.
- [ ] T037 [US4] Create `backend/app/routers/slots.py` and include it in `backend/app/main.py` under `API_PREFIX`.
  - `GET /doctors/{slug}/slots`, query `from_` (alias `from`, a date) and `days` (1–60).
  - Uses `ClockDep` and the repositories, maps `DayOut` to `DoctorSlots` (instants via `utc_iso`), and sets `Cache-Control: no-store`.
  - `responses` documents 404/422/429/503.
- [ ] T038 [US4] Remove `("/api/v1/doctors/{slug}/slots","get")` from `PENDING_BOOKING_OPERATIONS`, and uncomment `Slot`, `SlotDay` and `DoctorSlots` in the expected-schemas tuple of `backend/tests/unit/test_openapi_contract.py`. Run the contract tests.
- [ ] T039 [P] [US4] Add a perf check to `backend/tests/perf/test_latency.py` (`-m perf`): the slots endpoint p95 is at most 300 ms over 50 calls for a seeded doctor with a 14-day window. Record the result in `results.md`.
- [ ] T040 [US4] Create the website slots route `frontend/src/app/api/booking/slots/[doctorSlug]/route.ts`.
  - `GET`: validate the slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, else `404`) and pass through `from` and `days` when valid.
  - Call `callBooking` with a 5 s timeout and validate `200` bodies with `DoctorSlotsSchema` (invalid → `502` `bad_gateway`).
  - Pass through `404/422/429` (with `Retry-After`) and `503`. Unconfigured or network failure → `503` `service_unavailable`.
  - Always set `Cache-Control: no-store`.
  - Test in `frontend/tests/unit/booking-slots-route.test.ts`.
- [ ] T041 [P] [US4] Create the day and slot formatting helpers.
  - `frontend/src/lib/booking/labels.ts`:
    - `dayStatusLabel(status)`: Available, Fully booked, Not available, Clinic closed, Not available, No times left today;
    - `partOfDay(localTime)`: morning < 12:00, afternoon < 17:00, evening otherwise;
    - `formatLocalDate(date, timeZone)` with `Intl.DateTimeFormat("en-PK", …)`, e.g. "Tue 6 Oct".
  - Unit test in `frontend/tests/unit/booking-labels.test.ts`.

**CHECKPOINT 3**: `uv run pytest tests/unit/test_slots.py tests/api/test_slots_api.py tests/unit/test_openapi_contract.py` green; `npm test` green; with the dev stack running, `curl http://localhost:3000/api/booking/slots/dr-omar-sheikh` shows the Tuesday break and the seeded leave and holiday. Report to the user.

---

## Phase 4: User Story 1 — Book an appointment in under a minute (Priority: P1) 🎯 MVP

**Goal**: department → doctor → date → time → details → confirm creates a confirmed booking and shows the masked confirmation page (FR-020–FR-025, FR-050–FR-053, FR-070, FR-072–FR-074).

**Independent Test**: with seeded schedules and no bookings, complete the flow on a mobile viewport. The confirmation shows a reference and masked details, and that time disappears from the doctor's slots.

### Tests for User Story 1 ⚠️

- [ ] T042 [P] [US1] Write `backend/tests/unit/test_validation.py`.
  - Load `specs/005-appointment-booking/contracts/fixtures/phone-cases.json`; every case normalizes as listed.
  - Names: Urdu script, apostrophes and hyphens accepted; digits, `<`, one character and 81 characters rejected; trimmed.
  - Email: lowercased; invalid rejected; empty → `None`.
  - Reason: up to 300 characters; control characters stripped.
- [ ] T043 [P] [US1] Write `backend/tests/unit/test_masking.py` and `backend/tests/unit/test_reference.py`.
  - Masking:
    - "Ali Khan" → `A**** K****`;
    - "Muhammad Ali Raza Khan" → `M**** A**** R****` (at most 3 words shown);
    - Urdu name → first letter + `****`;
    - `+923001234567` → `0300****567`.
  - Reference: 10 characters from the Crockford alphabet; `display()` gives `XXXXX-XXXXX`; `parse()` accepts lowercase, a dash and spaces and rejects I/L/O/U; 10 000 generated references are unique.
- [ ] T044 [P] [US1] Write `backend/tests/api/test_appointments_api.py` (db, frozen clock, proxy secret header set). Cover:
  - **Success**: `201` returns an `AppointmentView` with masked name and mobile, fee equal to the doctor's fee, `isSample: true`, `Cache-Control: no-store`; afterwards the slots endpoint no longer lists that time.
  - **`422` validation**: extra field `feePkr` in the body (schema forbids extras), `acceptRules: false`, an inactive doctor.
  - **`409 slot_unavailable` with alternatives**: an off-grid time, a past time, a time inside the lead window, a leave time, a holiday, a time outside the window.
  - **`403`**: missing or wrong `X-Proxy-Secret`; a valid secret with a foreign `Origin` header (Principle VI).
  - **Lookup**: `GET /appointments/{reference}` → `200` masked, without email or reason keys; lowercase and dashless references work; an unknown reference returns `404` with a body identical to any other unknown reference.
  - **Audit**: an `audit_log` row `appointment.created` / `ok` exists with a fingerprint and no personal columns.
- [ ] T045 [P] [US1] Write `frontend/tests/unit/booking-phone.test.ts`. It reads the same `phone-cases.json` (via `fs`, path relative to the repo) and asserts that `normalizePkMobile()` matches every case, plus the form zod schema messages.
- [ ] T046 [P] [US1] Write `frontend/tests/unit/booking-appointments-route.test.ts`. Cover:
  - **Origin guard**: missing `Origin`, a cross-origin `Origin`, and `Sec-Fetch-Site: cross-site` all get `403`; a non-JSON content type gets `415`; a body over 4 KB gets `413`.
  - **Forwarding**: the secret, client IP, `X-Request-ID` and `Idempotency-Key` are forwarded; an invalid key gets `422`.
  - **Pass-through**: `201`/`409`/`422`/`429` (`Retry-After` kept) and `403` pass through after zod validation; an invalid backend body gets `502`; a timeout gets `504 timeout`, which the flow treats as "unknown, retry safe".
  - **Logging**: no body is logged.
- [ ] T047 [P] [US1] Write `frontend/tests/unit/booking-flow-url.test.ts`. `parseFlowParams`/`serializeFlowParams` round-trip; invalid slug, date or time is dropped; the step is derived as the deepest valid step; no other keys are ever emitted.
- [ ] T048 [P] [US1] Write `frontend/tests/unit/booking-flow.test.tsx` (Testing Library, mocked `fetch`). Cover:
  - **Step order**: department → doctor (filtered, "Sample" label, fee) → date (unavailable days disabled with their label) → time (grouped by part of day) → details → confirm.
  - **Rules checkbox**: an unchecked box blocks submit with an accessible error.
  - **Back**: Back keeps choices.
  - **Focus**: moves to each step heading, and to the first invalid field on `422`.
  - **Notice**: the details step shows the exact text "Demo site: please don't enter real medical details", referenced by the form's `aria-describedby`.
  - **Trap field**: present, `tabIndex=-1`, `aria-hidden`, `autoComplete="off"`.
  - **Edge cases** (spec Edge Cases):
    - A doctor whose 14 days have no `available` day shows "No online slots in the next 14 days — please call the clinic" with a `tel:` link.
    - A department with no active doctors shows the same call-the-clinic message, rather than being hidden.
    - A POST answered `422` with `details[].field == "doctorSlug"` (doctor became inactive) shows "This doctor is no longer available for online booking." and returns to the doctor step, keeping the form values.
- [ ] T049 [US1] Write the main e2e `frontend/tests/e2e/booking.spec.ts` (mock API in `ok` mode, `POST /__reset` before each test).
  - Keyboard-only booking at Pixel 7 and desktop; it must finish in under 60 s (record the time in the test annotation).
  - The confirmation shows a reference matching `^[0-9A-Z]{5}-[0-9A-Z]{5}$`, `A**** K****`-style name, `0300****567`-style mobile, doctor, date and time, fee and the "Before your visit" list.
  - The time is followed by the time zone label from `Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })` (for Asia/Karachi: "Pakistan Standard Time"). The same label appears on the time step.
  - With `page.emulateMedia({ reducedMotion: "reduce" })`, step transitions have no animation (no element with a running `transform` or `opacity` transition after a step change).
  - axe (`@axe-core/playwright`) shows 0 serious/critical violations on every step and on the confirmation page.
  - Reloading the confirmation page shows the same masked view.

### Implementation for User Story 1

- [ ] T050 [P] [US1] Implement `backend/app/booking/validation.py`.
  - `normalize_pk_mobile(raw) -> str | None` (research R9: strip `[\s\-.()]`, then `^(?:\+92|0092|92|0)(3\d{9})$` on ASCII digits only).
  - `clean_name`, `clean_email`, `clean_reason`.
  - Each raises `ValueError` with a short reason that never contains the input.
- [ ] T051 [P] [US1] Implement `backend/app/booking/masking.py`: `mask_name(name)` and `mask_mobile(e164)` (local form `0` + digits: first 4 + `****` + last 3).
- [ ] T052 [P] [US1] Implement `backend/app/booking/reference.py`: `ALPHABET`, `new_reference()` (`secrets.choice` × 10), `display(ref)`, `parse(text) -> str | None`.
- [ ] T053 [US1] Add `AppointmentCreate` and `AppointmentView` to `backend/app/schemas.py`.
  - `AppointmentCreate`: `extra="forbid"`; field validators call `validation.py` and the validated model holds normalized values; `accept_rules: Literal[True]`; `trap: str | None`; `starts_at` must be aware.
  - `AppointmentView`: nested `doctor` and `department` objects.
- [ ] T054 [US1] Implement `backend/app/repositories/appointments.py`.
  - `insert_appointment(session, **fields) -> Appointment`, which raises `IntegrityError` to the caller.
  - `get_by_reference(session, ref)`, joined with doctor and department for the view.
  - `count_active_for_phone(session, phone, now)`.
  - `active_rules_version(session)`: SHA-256 of the active rules' text in `sort_order`, first 16 hex characters.
- [ ] T055 [P] [US1] Implement `backend/app/booking/audit.py`: `write_audit(session, *, action, outcome, fingerprint, target_id=None, request_id)`, which only accepts the enum values from data-model §8.
- [ ] T056 [US1] Implement `create_appointment(session, *, data: AppointmentCreate, client_ip, request_id, clock, settings) -> AppointmentView` in `backend/app/booking/service.py`.
  - **One transaction, in order**:
    1. load the doctor;
    2. load the window data and run `slots.is_available` (`None` → `BookingConflict("slot_unavailable", …, alternatives=next_free(...))`);
    3. compute the fee and end time on the server;
    4. insert with `new_reference()`, retrying once on the unique violation of `reference`;
    5. `write_audit(... "appointment.created", "ok")`;
    6. commit.
  - Leave clearly named hook points (comments `# US3 idempotency`, `# US6 limits/lock`, `# US7 purge`) for later phases. Return the masked view.
- [ ] T057 [US1] Create `backend/app/routers/appointments.py` and include it in `backend/app/main.py`.
  - `POST /appointments`: dependencies `require_proxy_secret`, `ClockDep`, `get_client_ip`; returns `201`; `Cache-Control: no-store`.
  - `GET /appointments/{reference}`: `parse()` → `404` when invalid or unknown, with the same body for both; `no-store`.
  - Document all statuses in `responses` per the contract.
- [ ] T058 [US1] Remove both appointment operations from `PENDING_BOOKING_OPERATIONS` (the set is now empty, so delete it), and add `AppointmentView` and `BookingConflict` to the expected schemas in `backend/tests/unit/test_openapi_contract.py`. Run the contract tests.
- [ ] T059 [P] [US1] Implement `frontend/src/lib/booking/phone.ts` (`normalizePkMobile`, same rules as the backend) and `frontend/src/lib/booking/form.ts` (zod `DetailsFormSchema`: `fullName`, `mobile` refined with `normalizePkMobile`, optional `email`, optional `reason` up to 300, `acceptRules: z.literal(true)` with the message "Please accept the clinic rules to continue.", `trap` optional).
- [ ] T060 [US1] Create `frontend/src/app/api/booking/appointments/route.ts`.
  - `POST` only.
  - **Guards**: Origin / `Sec-Fetch-Site`, content type and size (contracts/website-booking.md §1); the `Idempotency-Key` UUID v4 check.
  - **Call**: `callBooking` with a 15 s timeout and the client IP from `clientIpFrom(request.headers)`.
  - **Responses**: zod-validate and pass through; set `Cache-Control: no-store`.
- [ ] T061 [P] [US1] Implement `frontend/src/lib/booking/flowUrl.ts`.
  - `FlowParams { department?, doctor?, date?, time?, step }`, with `parseFlowParams(searchParams, catalog)` and `serializeFlowParams(params)`.
  - Only slugs, a `YYYY-MM-DD` date, an `HH:MM` time and the step name are ever written.
- [ ] T062 [P] [US1] Create the step components in `frontend/src/components/booking/`:
  - `StepIndicator.tsx`: an ordered list with `aria-current="step"`;
  - `DepartmentStep.tsx`: department cards using the existing card styles;
  - `DoctorStep.tsx`: the existing `DoctorCard` look, with the "Sample" badge and fee;
  - `DateStrip.tsx`: horizontally scrollable radio group, disabled days with their status label;
  - `SlotGrid.tsx`: radio buttons of at least 44 × 44 px, grouped by part of day with headings.

  All use existing tokens only; no new colours.
- [ ] T063 [US1] Create `frontend/src/components/booking/DetailsForm.tsx` (React Hook Form + `zodResolver(DetailsFormSchema)`).
  - **Above the fields**: `<p id="booking-demo-notice">Demo site: please don't enter real medical details</p>`, with `aria-describedby="booking-demo-notice"` on the `<form>`.
  - **Fields**: labelled full name, mobile (`inputMode="tel"`, `autoComplete="tel"`), email, reason (with a counter).
  - **Rules**: a checkbox "I accept the clinic rules" linked to the rules list on the page.
  - **Trap field**: named `website`, hidden visually and from assistive technology (`aria-hidden`, `tabIndex=-1`, `autoComplete="off"`), mapped to `trap`.
  - **Errors**: tied to fields via `aria-describedby`, with an error summary that gets focus.
- [ ] T064 [US1] Create `frontend/src/components/booking/BookingFlow.tsx` (`"use client"`).
  - **State**: `useReducer` state; props `departments`, `doctors`, `rules`, `clinicPhone`, `timeZone`.
  - **URL**: read with `useSearchParams` and `parseFlowParams`; `router.push` on step forward and `router.replace` when fixing invalid params.
  - **Slots**: fetched from `/api/booking/slots/{slug}` with `cache: "no-store"`; loading skeleton; an `aria-live="polite"` region announces step changes.
  - **Submit**: POST `/api/booking/appointments` (the idempotency key comes in US3; for now a fresh `crypto.randomUUID()` per submit); on `201`, `router.replace("/book-appointment/confirmed/" + reference)`; on `422`, map `details[].field` to form errors.
  - **Other errors**: generic friendly error for anything else (specific mapping comes in US2, US3 and US6).
  - **Edge cases** (tests in T048):
    - A doctor with no available day in the window gets the call-the-clinic message.
    - A department with no active doctors gets the same message.
    - A `422` on `doctorSlug` gets the "no longer available" note and returns to the doctor step.
    - Every step transition uses the existing motion helpers in `src/lib/motion.ts`, which respect `prefers-reduced-motion`.
- [ ] T065 [P] [US1] Create `frontend/src/components/booking/BookingUnavailable.tsx`. It reuses `DataUnavailable` / `EmptyState`: "Online booking is temporarily unavailable. Please call the clinic." with a `tel:` link to the clinic phone and a Retry button.
- [ ] T066 [US1] Replace the holding page in `frontend/src/app/book-appointment/page.tsx`.
  - Replace `ComingSoon` with a `<Suspense>`-wrapped `<BookingFlow>`, fed from the cached catalog (`loadDepartments`, `loadDoctors`, `getClinicRules`, `getSiteConfig` from `src/lib/content.ts`).
  - Keep `<BeforeYourVisit rules={rules} />` with `id="clinic-rules"` for the checkbox link.
  - When the catalog data is unavailable, render `BookingUnavailable`.
  - In `frontend/src/lib/pages.ts`, change the `/book-appointment` entry: title "Book an appointment", description "Book an appointment with a sample doctor (portfolio demo)."
  - Keep the page out of the sitemap, as today (plan "Scope notes").
- [ ] T067 [US1] Create `frontend/src/app/book-appointment/confirmed/[reference]/page.tsx` and `frontend/src/components/booking/ConfirmationCard.tsx`.
  - Dynamic server component; `metadata: { robots: { index: false, follow: false }, referrer: "no-referrer" }`.
  - Validate the reference format (`notFound()` if invalid), then `callBooking({ method: "GET", path: "/appointments/" + ref, clientIp, timeoutMs: 5000 })`.
  - **`200`**: show the masked view, the time zone label, fee, clinic address and phone, `BeforeYourVisit`, and the note "This is a demo booking. No one will contact you."
  - **`404`**: the generic "Booking not found" page.
  - **Unavailable**: "We can't show your booking right now. Your reference is {display(ref)}." plus the clinic phone.
- [ ] T068 [US1] Remove the holding page and update every test that expects it.
  - **Delete** `frontend/src/components/coming-soon/ComingSoon.tsx` and `frontend/tests/unit/coming-soon.test.tsx`. Nothing else imports the component (verified with grep at planning time; re-check before deleting).
  - **Update these tests**, which assert "Booking coming soon":
    - `frontend/tests/e2e/links.spec.ts`, lines about 55 and 91–92: `/book-appointment` now has the h1 "Book an appointment" and must not match `/coming soon/i`;
    - `frontend/tests/e2e/doctors.spec.ts`, about lines 151–155: the Book button lands on the booking flow at the date step (`?doctor=` comes in US5; until then assert the h1 only);
    - `frontend/tests/e2e/departments.spec.ts`, about lines 76–82: same, at the department or doctor step;
    - `frontend/tests/e2e/rules.spec.ts`, `frontend/tests/e2e/stateful/rules-modes.spec.ts` and `frontend/tests/e2e/offline/unset.spec.ts`: the rules list is still on `/book-appointment`, and the assertions are adjusted if they referenced the holding text.
  - Run `npx playwright test visual-baseline -g "book-appointment" --update-snapshots` and review the diff.
  - Run `npm test && npm run test:e2e`; nothing may still reference "Booking coming soon".

**CHECKPOINT 4 (MVP)**: the backend suite is green, including T042–T044; `npm test` and `npm run test:e2e` are green (T049 passes in under 60 s with 0 serious axe violations); a manual run on the dev stack books a slot end to end. Report to the user with a screenshot of the confirmation page.

---

## Phase 5: User Story 2 — No double-booking, ever (Priority: P1)

**Goal**: simultaneous bookings for one slot give exactly one success. The loser gets a "slot just taken" message with alternatives and keeps their details (FR-030–FR-032).

**Independent Test**: 20 simultaneous requests for one slot → exactly 1 × `201`, 19 × `409 slot_taken`, and one confirmed row.

### Tests for User Story 2 ⚠️

- [ ] T069 [P] [US2] Write `backend/tests/api/test_booking_concurrency.py` (db, `committing_engine`).
  - A `threading.Barrier(20)` and a `ThreadPoolExecutor(20)`. Each thread calls the HTTP API through its own `TestClient` from `make_committing_client`, with a distinct mobile and idempotency key for the same slot.
  - Assert: statuses `Counter` equals `{201: 1, 409: 19}`; every `409` body has `error.code == "slot_taken"` and 1–5 alternatives; `SELECT count(*)` of confirmed rows for that doctor and start is 1.
  - A second test books 10:00–10:15 and then attempts a 10:00–10:30 overlap (by changing the session's `slot_minutes` to 30 in-test) → `409 slot_taken`.
- [ ] T070 [P] [US2] Add `backend/tests/perf/test_booking_concurrency_repeat.py` (`@pytest.mark.perf`): repeat the 20-thread race 100 times on fresh slots and assert 0 double-bookings. Record the run in `results.md` (SC-002).
- [ ] T071 [P] [US2] Write the stateful e2e `frontend/tests/e2e/stateful/booking-race.spec.ts`.
  - Two browser contexts pick the same slot. Context A confirms first. Context B confirms (mock `slot-taken` mode, or the real store conflict).
  - B sees "Sorry, this slot was just taken.", up to 5 alternatives, and its name, mobile, email and reason still filled.
  - B picks an alternative, confirms, and reaches a confirmation page.
  - `/__log` shows that B's second POST carried a different `Idempotency-Key`.

### Implementation for User Story 2

- [ ] T072 [US2] Map a lost race to `slot_taken` in `backend/app/booking/service.py`.
  - Wrap the insert: catch `sqlalchemy.exc.IntegrityError` whose `orig.sqlstate == "23P01"` and `orig.diag.constraint_name == "ex_appointment_no_overlap"`.
  - Roll back, then compute `next_free(after=requested start, limit=5)` in a fresh read-only transaction.
  - Raise `BookingConflict("slot_taken", "Sorry, this slot was just taken.", alternatives)`.
  - Write `write_audit(... "appointment.rejected", "slot_taken")` in that second transaction.
  - Re-raise any other `IntegrityError`.
- [ ] T073 [US2] Show the slot-taken notice in the flow.
  - Create `frontend/src/components/booking/SlotTakenNotice.tsx`: a `role="alert"` heading, then an alternatives list as buttons ("Tue 6 Oct, 10:30"), plus "See all times".
  - In `BookingFlow.tsx`, on `409 slot_taken`/`slot_unavailable`, keep the RHF values, render `SlotTakenNotice`, and on choice set date and time, regenerate the idempotency key, and return to the confirm step.
- [ ] T074 [US2] Add a component test to `frontend/tests/unit/booking-flow.test.tsx`: a `409` with alternatives keeps all field values, focuses the alert, and choosing an alternative updates the summary and resubmits with a new key.

**CHECKPOINT 5**: `uv run pytest -k concurrency` green (run it 3 times); `npm run test:e2e:stateful -- booking-race` green. Report the concurrency results to the user.

---

## Phase 6: User Story 3 — Retries and double clicks are safe (Priority: P1)

**Goal**: the same idempotency key never creates two bookings, including concurrent repeats (FR-040–FR-042).

**Independent Test**: send one request three times with the same key, two of them concurrently. Exactly one booking exists, and all responses carry the same reference.

### Tests for User Story 3 ⚠️

- [ ] T075 [P] [US3] Write `backend/tests/api/test_idempotency.py` (db, `committing_engine`).
  - **Replay**: a sequential replay returns `201` with the same reference, and there is one row.
  - **Concurrency**: 5 concurrent identical requests (barrier) → one row and five identical references.
  - **Conflict**: the same key with a different reason → `409 idempotency_key_reused`, and nothing created.
  - **Header**: missing or non-UUIDv4 `Idempotency-Key` → `422`.
  - **Failed attempt**: after a `409 slot_taken`, a retry with the same key gets `slot_taken` again (no key row stored).
  - **Expiry**: with the clock frozen at +25 h, the expired row is cleaned up and the key is treated as new.
  - **Privacy**: the `idempotency_key` table holds only a hash (assert that no column contains the name or mobile).
- [ ] T076 [P] [US3] Write the stateful e2e `frontend/tests/e2e/stateful/booking-retry.spec.ts`.
  - A double click on Confirm → one POST in `/__log` and one confirmation.
  - In `booking-slow` mode the client times out: the visitor sees "We couldn't confirm your booking yet. It's safe to try again; you won't be booked twice." Then switch the mode to `ok`, press Try again, and assert that `/__log` shows the same `Idempotency-Key` and that there is one booking.

### Implementation for User Story 3

- [ ] T077 [US3] Implement `backend/app/booking/idempotency.py`.
  - `precheck(session, key, req_hash, now) -> UUID | None` (`None` when absent or expired; raise `BookingConflict("idempotency_key_reused")` on a hash mismatch).
  - `claim(session, key, req_hash, now) -> UUID | None`: `INSERT … ON CONFLICT (key) DO NOTHING RETURNING key`; when nothing is returned, re-select and return the existing `appointment_id`, or raise on a hash mismatch.
  - `link(session, key, appointment_id)`.
  - `cleanup(session, now, limit=200)`: deletes expired rows via `ctid IN (SELECT … LIMIT 200)`.
- [ ] T078 [US3] Wire idempotency into `backend/app/booking/service.py` and `backend/app/routers/appointments.py`.
  - The router takes the `Idempotency-Key` header (`UUID`; reject non-v4 with `422`).
  - The service computes `request_hash` from the normalized doctor slug, `startsAt` (UTC ISO), name, mobile, email and reason.
  - It runs `precheck` before everything else; a hit returns the stored appointment's view.
  - Inside the transaction it runs `claim` right after the transaction begins; a replay returns that view without inserting.
  - It calls `link` after the insert, and `cleanup` before committing.
- [ ] T079 [US3] Handle the idempotency key in the browser.
  - Create `frontend/src/lib/booking/idempotency.ts`: `createAttemptKey()` (`crypto.randomUUID()`) and a `useAttemptKey(deps)` hook that keeps one key per (slot + details hash) and resets it when either changes or after success.
  - In `BookingFlow.tsx`:
    - use the hook;
    - disable Confirm and show a spinner while the request is in flight; ignore repeated Enter or clicks;
    - on timeout, `502`, `503` or `504`, show the safe-retry message with a Try again button that reuses the key.
  - Unit test in `frontend/tests/unit/booking-idempotency.test.ts`.

**CHECKPOINT 6**: `uv run pytest -k "idempotency or concurrency"` green; `npm test` and `npm run test:e2e:stateful` green. Report to the user.

---

## Phase 7: User Story 6 — Abuse cannot flood the schedule (Priority: P2)

**Goal**: shared Postgres rate limits per IP and per phone, a lookup limit, the trap field, and max active bookings per phone (FR-060–FR-062).

**Independent Test**: exceed each limit and get the documented refusal, with no booking created.

### Tests for User Story 6 ⚠️

- [ ] T080 [P] [US6] Write `backend/tests/api/test_booking_limits.py` (db, `committing_engine`, limits lowered through `make_committing_client(booking_limit_per_ip_per_hour=3, booking_limit_per_phone_per_day=2, lookup_limit_per_ip_per_minute=3)`). Cover:
  - **IP limit**: the 4th attempt from one `X-Client-IP` → `429` with `Retry-After`, standard error body, and an audit row `rate_limited_ip`.
  - **Phone limit**: the 3rd attempt with one mobile from different IPs → `429`, audit `rate_limited_phone`. Mobile written in two formats counts as the same number.
  - **Max active**: with max active = 3, the 4th booking → `409 booking_limit_reached`, also when 5 different-slot requests for one phone run concurrently (exactly 3 succeed).
  - **Trap**: `trap="x"` → `400 request_rejected`, no appointment, IP counter incremented, audit `trap`.
  - **Lookup**: the 4th lookup per minute → `429`.
  - **Counters**: `rate_limit_counter.bucket` values never contain the IP or phone.
  - **Window**: after advancing the frozen clock past the window, attempts are allowed again.
  - **Replays**: a replay with an existing idempotency key does not consume the limits.

### Implementation for User Story 6

- [ ] T081 [US6] Implement `backend/app/booking/limits.py`.
  - `hit(engine_or_conn, bucket, window: timedelta, limit, now) -> int | None` (`None` when allowed, else seconds to retry).
  - It runs a single upsert in its own autocommitted connection (`engine.begin()`), with `window_start = floor(now, window)`.
  - `cleanup_counters(conn, now, limit=200)`.
  - Bucket builders `booking_ip_bucket(ip)`, `booking_phone_bucket(phone)` and `lookup_ip_bucket(ip)` use `privacy.hmac_hex`.
- [ ] T082 [US6] Wire the abuse checks into `backend/app/booking/service.py` and `backend/app/routers/appointments.py`, in this order:
  1. idempotency precheck;
  2. trap → IP hit, audit `trap`, `RequestRejected`;
  3. IP limit → `RateLimited`, plus audit;
  4. phone limit → `RateLimited`, plus audit;
  5. in the transaction: `SELECT pg_advisory_xact_lock(hashtextextended(:phone_bucket, 0))` first, then claim the idempotency key, then `count_active_for_phone` ≥ max → `BookingConflict("booking_limit_reached", "This mobile number already has the maximum upcoming bookings. Please call the clinic.")` with an audit row.

  - `GET /appointments/{reference}` first hits `lookup_ip_bucket`.
  - The service gets the engine via the `get_engine` dependency, so tests can override it.
- [ ] T083 [US6] Map the abuse responses in `frontend/src/components/booking/BookingFlow.tsx` (contracts/website-booking.md §2).
  - `429`: show the "Too many attempts…" message with the clinic phone, and disable Confirm for `Retry-After` seconds (max 120) with a visible countdown.
  - `409 booking_limit_reached` and `400 request_rejected`: their messages plus the phone.
  - Unit tests in `frontend/tests/unit/booking-flow.test.tsx`.
  - Stateful e2e `frontend/tests/e2e/stateful/booking-limits.spec.ts` (`rate-limited` mode): the message is shown and Confirm is disabled.

**CHECKPOINT 7**: `uv run pytest -k limits` green; `npm test` and `npm run test:e2e:stateful` green. Report the limit values and the evidence to the user.

---

## Phase 8: User Story 7 — Privacy, honesty and demo retention (Priority: P2)

**Goal**: no personal data in URLs or logs, honest labels on every step, truthful site wording, and automatic purge of demo bookings 7 days after the appointment (and of audit rows after 90 days) (FR-051–FR-054, FR-056, FR-074).

**Independent Test**: complete a booking while capturing URLs and logs; no personal data appears. With a frozen clock, a booking older than 7 days is purged at startup and after the next booking, while newer ones remain.

### Tests for User Story 7 ⚠️

- [ ] T084 [P] [US7] Extend `backend/tests/api/test_log_safety.py` (db).
  - Run with `caplog` at DEBUG and capture stdout: a successful booking, a slot-taken, a `422`, a `429`, a trap, and a lookup.
  - Assert that none of the name, raw mobile, E.164 mobile, email or reason appears in any log record or in the error bodies, except the masked forms.
  - Assert that the `audit_log`, `idempotency_key` and `rate_limit_counter` rows contain none of them.
- [ ] T085 [P] [US7] Write `backend/tests/api/test_retention.py` (db, `committing_engine`, frozen clock). Cover:
  - **Purge rule**: bookings ending 8 days ago are deleted; ones that ended 6 days ago, and future ones, are kept.
  - **Side effects**: their `idempotency_key` rows cascade; recent `audit_log` rows remain; the lookup of a purged reference returns `404`.
  - **Audit purge**: audit rows older than 90 days are deleted and newer ones kept; `audit_purge_after_days` is honoured.
  - **Demo mode off**: `demo_mode=False` purges nothing; `python -m app.booking.purge` exits non-zero with "Refusing to purge: DEMO_MODE is false"; with demo mode on it prints only `purged: <n>`.
  - **Startup purge**: runs on app startup, through the lifespan within `TestClient` context.
  - **Post-booking purge**: runs after a booking commit, removing at most 200 rows per run.
  - **Database down**: with an unreachable database (settings pointing at a closed port), the app still starts, `/health` returns `200`, and a `purge_failed` warning is logged without data.
- [ ] T086 [P] [US7] Write `frontend/tests/e2e/booking-privacy.spec.ts` (main).
  - Collect every request URL via `page.on("request")` and every `page.url()` during a full booking with distinctive values (name "Zubair Testcase", mobile 03123456789, email and reason). Assert that none of them appears.
  - Fetch `/__log` from the mock and assert the same.
  - Assert that the confirmation page sends `referrer: no-referrer` and `robots: noindex`.
- [ ] T087 [P] [US7] Extend `frontend/tests/e2e/honesty.spec.ts`: on every booking step and on the confirmation page, the demo notice "Portfolio demo — not a real clinic, not medical advice." is visible, doctors show "Sample", and the details step shows exactly "Demo site: please don't enter real medical details".
- [ ] T088 [P] [US7] Write copy tests for FR-056 / SC-013. All must fail until T093.
  - New `frontend/tests/unit/booking-copy.test.ts`: grep `frontend/src/**/*.{ts,tsx}` (outside `tests/`) for `/not available in this demo|coming soon|holding page|collects no personal data|no booking forms/i` and expect 0 hits.
  - In `frontend/tests/unit/legal.test.ts`, the privacy content mentions: name, mobile, optional email and reason; "7 days"; "90 days"; that no messages are sent; that the contact form still sends nothing.
  - Update the expectations in `frontend/tests/unit/faq-group.test.tsx` (line about 80, currently `/not available in this demo yet/i`) and `frontend/tests/unit/about-content.test.tsx` to the new wording.

### Implementation for User Story 7

- [ ] T089 [US7] Implement `backend/app/booking/retention.py`: `purge_demo_bookings(conn, *, now, after_days, audit_after_days, limit: int | None = 200) -> int`.
  - It deletes from `appointment` where `ends_at < now - after_days`, then from `audit_log` where `occurred_at < now - audit_after_days`, each in batches via a `ctid` subquery.
  - With `limit=None` it loops until a batch deletes fewer rows than the batch size.
  - It logs `{"event": "purge", "deleted": n}` only.
- [ ] T090 [US7] Create the CLI `backend/app/booking/purge.py`, run with `python -m app.booking.purge`.
  - It loads settings (fail fast) and refuses when `demo_mode` is false (exit 2, message on stderr).
  - It runs `purge_demo_bookings(limit=None)` in one transaction, prints `purged: <n>` and exits 0. A database error prints "purge failed: <ExceptionType>" and exits 1.
- [ ] T091 [US7] Purge on startup and after each booking.
  - In `backend/app/main.py`, add a `lifespan` context manager: when `settings.demo_mode`, schedule `asyncio.to_thread(_startup_purge)` as a background task (not awaited before serving). `_startup_purge` catches every exception and logs the warning `purge_failed` with the exception type only.
  - In `backend/app/booking/service.py`, after a successful commit and when demo mode is on, call `purge_demo_bookings(limit=200)` in a separate short transaction, inside `try/except` that logs `purge_failed`.
- [ ] T092 [US7] Check that `DetailsForm.tsx` (T063) and `ConfirmationCard.tsx` (T067) carry the exact demo copy. Add the "Sample" badge to the doctor summary on the confirm step and on `ConfirmationCard.tsx`, reusing the existing badge component.
- [ ] T093 [US7] Make the site's wording truthful (FR-056).
  - **Privacy page**, `frontend/src/data/legalContent.ts`, "What this demo collects" (about line 25). Replace "This demo collects no personal data…" with paragraphs saying:
    - the booking form collects name, mobile and, if given, email and reason, only to show the demo booking;
    - bookings are deleted automatically 7 days after the appointment time;
    - a non-reversible network fingerprint is kept in audit records for 90 days to stop abuse;
    - no SMS or email is ever sent;
    - the contact form still sends nothing.
  - Keep "no tracking cookies, no analytics".
  - **Terms page**, about line 151: replace "You cannot book an appointment… lead to a holding page…" with "You can make a demo booking with a sample doctor. It is not a real appointment and no one will contact you. You cannot pay for a test or receive a report through this demo." Also extend line 140 to "Do not enter real personal or health information into the contact or booking forms."
  - **FAQ**, `frontend/src/data/faq.ts` (about line 18): "You can try online booking with the sample doctors. It is a demo: bookings are not real, no one will contact you, and they are deleted 7 days after the appointment time."
  - **About**, `frontend/src/data/aboutContent.ts` (about line 68): "Online booking works as a demo with sample doctors; bookings are not real."
  - Update the visual baselines for `/privacy`, `/terms`, `/faq` and `/about`. Review the diffs: text only.
  - T088 must now pass.

**CHECKPOINT 8**: `uv run pytest -k "log_safety or retention"` green; `npm test` (copy tests) and `npm run test:e2e` green, including privacy and honesty; text-only visual diffs for privacy, terms, FAQ and about reviewed. Manual check: `uv run python -m app.booking.purge` prints a count on dev. Report to the user.

---

## Phase 9: User Story 5 — "Book" from a doctor's page (Priority: P2)

**Goal**: the Book buttons pre-select the doctor (or department) and open the flow at the next step (FR-071).

**Independent Test**: from `/doctors/dr-ayesha-rahman`, press Book appointment; the flow opens at the date step with that doctor shown as selected and changeable.

### Tests for User Story 5 ⚠️

- [ ] T094 [P] [US5] Write `frontend/tests/e2e/booking-entry.spec.ts` (main).
  - The Book button on a doctor profile goes to `?doctor=<slug>` at the date step, with the doctor and department shown.
  - Going back lets the visitor change the doctor.
  - A department page's Book button goes to `?department=<slug>` at the doctor step.
  - `?doctor=unknown-slug` starts at the department step with the polite note "That doctor isn't available for online booking. Please choose a department."
  - Timing (SC-001): from opening `/doctors/dr-ayesha-rahman` to the confirmation page, keyboard only, takes under 45 s (recorded as a test annotation).
- [ ] T095 [P] [US5] Extend `frontend/tests/unit/routes.test.ts` for `bookingPath({ doctor })` and `bookingPath({ department })`, which build URL-encoded query strings.

### Implementation for User Story 5

- [ ] T096 [US5] Add `bookingPath(params?: { doctor?: string; department?: string })` to `frontend/src/lib/routes.ts`, returning `ROUTES.bookAppointment` with the query string.
- [ ] T097 [US5] Update `frontend/src/app/doctors/[slug]/page.tsx`.
  - The Book button `href` becomes `bookingPath({ doctor: doctor.slug })`.
  - Replace the sentence "Booking is not available in this demo yet. This is a sample profile; nothing here is real." with "Online booking is a portfolio demo. This is a sample profile; nothing here is real."
- [ ] T098 [P] [US5] Update both Book buttons in `frontend/src/components/departments/DepartmentSections.tsx` to `bookingPath({ department: department.slug })`, using the department slug from props. Replace the note "Booking is not available in this demo yet." (about line 57) with "Online booking is a portfolio demo with sample doctors." (FR-056).
- [ ] T099 [US5] Implement the pre-select handling in `frontend/src/components/booking/BookingFlow.tsx` and `frontend/src/lib/booking/flowUrl.ts`.
  - `doctor` given → set the department from the doctor and start at the date step.
  - Unknown or inactive doctor → the note above plus the department step.
  - `department` given → start at the doctor step.
- [ ] T100 [US5] Update the visual baselines for all doctor and department pages (`npx playwright test visual-baseline -g "doctors-|departments-" --update-snapshots`). Review the diffs: only the changed sentence may differ. Note it in `results.md`.

**CHECKPOINT 9**: `npm test`, `npm run test:e2e` green; visual diffs reviewed. Report to the user.

---

## Phase 10: Resilience, Polish & Proof

**Purpose**: Principle V for booking, performance, documentation and the final gate.

- [ ] T101 [P] Extend `frontend/tests/e2e/offline/site.spec.ts`. With the API dead and with it unset, the build passes and `/book-appointment` renders `BookingUnavailable` with the clinic phone (fallback settings), the demo notice and no crash. `/book-appointment/confirmed/ABCDE-FGHJK` renders the friendly "can't show your booking right now" page.
- [ ] T102 [P] Write the stateful e2e `frontend/tests/e2e/stateful/booking-down.spec.ts` (`booking-down` mode).
  - The slots fetch fails → `BookingUnavailable` with Retry.
  - Switching back to `ok` and pressing Retry loads the times.
  - A POST during `booking-down` → the safe-retry message.
  - `/__log` proves the calls were made after each mode switch.
- [ ] T103 Run Lighthouse (same method as T003) on `/book-appointment` and `/doctors/dr-ayesha-rahman`. Record the results in `results.md`: performance ≥ 90 mobile and not lower than baseline; added client JS for the booking route ≤ 60 KB gzip (from `next build` output).
- [ ] T104 [P] Update the docs.
  - `backend/README.md`: booking endpoints, the new env settings with fail-fast behaviour, the purge CLI, how to run the concurrency test.
  - `frontend/README.md`: booking proxy routes, `BOOKING_PROXY_SECRET`, `instrumentation.ts` behaviour, the new mock modes.
  - Re-check `specs/005-appointment-booking/quickstart.md` by following it on a clean checkout.
- [ ] T105 Write the success-criteria evidence in `specs/005-appointment-booking/results.md`: SC-001…SC-013, each with the test name or measurement (SC-001 from T049 and T094, SC-002 from T070, SC-008 from T039 and T103, SC-011 from T085, SC-012 from T010 and T026, SC-013 from T088).
- [ ] T106 Run the final gate and record the results in `results.md`.
  - Backend: `uv run ruff check .`, `uv run mypy`, `uv run pytest`, `uv run pytest -m perf`.
  - Frontend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:e2e:stateful`, `npm run test:e2e:offline`, `npm run build` with `CATALOG_API_URL` and `BOOKING_PROXY_SECRET` unset.
  - `gitleaks detect --no-banner` from the repo root. If it flags the fake test secrets, apply the path-scoped allowlist described in T027, and never a global rule.

**CHECKPOINT 10 (done)**: all gates green, every SC evidenced. Report to the user and offer `/sp.git.commit_pr`.

---

## Requirements Traceability

Every functional requirement and success criterion in spec.md maps to at least one task.

| Requirement | Tasks |
|---|---|
| FR-001 sessions and breaks | T020, T032, T034 |
| FR-002 leave and holidays stored | T012, T013, T021 |
| FR-003 clinic time zone only | T011, T014, T032, T034 |
| FR-004 seed (break, leave, holiday; refuses production) | T020–T023 |
| FR-010 slots per day in the window | T034, T037 |
| FR-011 availability rules | T032, T034 |
| FR-012 day status and public reason | T034, T036, T041 |
| FR-013 no patient data or leave note in slots | T033 |
| FR-014 no stale slots | T037, T040, T044 |
| FR-020 booking fields | T053, T059, T063 |
| FR-021 Pakistani mobile normalization | T042, T045, T050, T059 |
| FR-022 server re-validation, fee and status from server | T044, T056 |
| FR-023 booking record contents | T054, T056 |
| FR-024 reference | T043, T052 |
| FR-025 sample flags | T012, T021, T092 |
| FR-030 database no-overlap | T013, T014, T069 |
| FR-031 slot-taken result with alternatives | T069, T072, T073 |
| FR-032 concurrency test | T069, T070 |
| FR-040 browser key per attempt | T079 |
| FR-041 replay, including concurrent | T075, T077, T078 |
| FR-042 reused key rejected | T075, T077 |
| FR-050 confirmation page | T049, T067 |
| FR-051 masked view, lookup | T043, T051, T057, T067 |
| FR-052 no personal data in URLs or logs | T029, T084, T086 |
| FR-053 audit log | T044, T055, T080 |
| FR-054 demo purge (bookings 7 d, audit 90 d) | T085, T089–T091 |
| FR-055 fail fast on secrets | T008, T010, T025, T026 |
| FR-056 truthful site wording | T088, T093, T097, T098 |
| FR-060 rate limits | T080–T082 |
| FR-061 honeypot | T063, T080, T082 |
| FR-062 max active bookings per mobile | T080, T082 |
| FR-070 step-by-step flow | T048, T061–T066 |
| FR-071 Book from doctor and department pages | T094–T099 |
| FR-072 existing design tokens | T062, T100 |
| FR-073 WCAG 2.2 AA, reduced motion | T048, T049, T062 |
| FR-074 demo labels and form notice | T048, T063, T087, T092 |
| FR-075 friendly state when the backend is down | T065, T101, T102 |
| FR-076 same-origin proxy, Origin and secret checks | T019, T028, T044, T046, T060 |
| FR-080 contract and drift check | T004–T007, T038, T058 |
| FR-081 unit test coverage | T032, T042, T043, T075, T080 |
| FR-082 end-to-end coverage | T049, T071, T094, T102 |

| Success criterion | Evidence tasks |
|---|---|
| SC-001 under 60 s, and under 45 s from a doctor page | T049, T094 |
| SC-002 100 race runs, 0 double-bookings | T069, T070 |
| SC-003 same key → 1 booking | T075, T076 |
| SC-004 slot reference cases | T032, T033 |
| SC-005 no personal data in URLs or logs | T084, T086 |
| SC-006 abuse limits | T080 |
| SC-007 axe and keyboard | T048, T049 |
| SC-008 times ≤ 1 s, Lighthouse ≥ 90 | T039, T103 |
| SC-009 rebook without retyping | T071, T073, T074 |
| SC-010 backend down → friendly page | T101 |
| SC-011 7-day purge | T085 |
| SC-012 fail fast on the secret | T010, T026 |
| SC-013 truthful wording | T088, T093 |

---

## Dependencies & Execution Order

### Phase dependencies

| Phase | Depends on |
|---|---|
| Phase 1 (Setup & contract) | nothing |
| Phase 2 (Foundational) | Phase 1. **Blocks every story.** |
| Phase 3 (US4 slots) | Phase 2 |
| Phase 4 (US1 MVP) | Phase 3 (needs the slot engine and slots route) |
| Phase 5 (US2) | Phase 4 (needs the booking service and flow) |
| Phase 6 (US3) | Phase 4. Can run in parallel with Phase 5 on the backend; both touch `service.py` and `BookingFlow.tsx`, so merge carefully or do them in sequence. |
| Phase 7 (US6) | Phase 6 (the limit order needs the idempotency precheck) |
| Phase 8 (US7) | Phase 4. The retention tasks (T085, T089–T091) can start after Phase 4; the privacy e2e (T086) runs best after Phase 7. |
| Phase 9 (US5) | Phase 4 only (independent of US2/US3/US6/US7) |
| Phase 10 | all stories |

### Within each story

- Tests are written first and fail.
- Backend: pure modules → repositories → schemas → service → router.
- Website: lib → route handler → components → page → e2e.
- Every phase ends at its checkpoint; report before continuing.

### Shared-file hot spots (do not run in parallel)

- `backend/app/booking/service.py`: T056, T072, T078, T082, T091.
- `frontend/src/components/booking/BookingFlow.tsx`: T064, T073, T079, T083, T099.
- `backend/tests/unit/test_openapi_contract.py`: T005, T038, T058.

---

## Parallel Examples

```text
# Phase 2 (after T008–T014): helpers in parallel
T015 clock.py   |  T016 privacy.py  |  T017 errors.py  |  T019 require_proxy_secret
T025/T026 website config + instrumentation  |  T030/T031 mock API

# Phase 3 (US4): tests in parallel, then engine
T032 test_slots.py  |  T033 test_slots_api.py  |  T041 labels.ts
→ T034 slots.py → T035 repo → T036 schemas → T037 router → T040 website route

# Phase 4 (US1): all test files in parallel
T042 | T043 | T044 | T045 | T046 | T047 | T048
# then pure modules in parallel
T050 validation.py | T051 masking.py | T052 reference.py | T055 audit.py | T059 phone/form | T061 flowUrl | T062 step components

# Phase 9 (US5) can be developed alongside Phases 5–8 by a second developer
T094 | T095 → T096 → T097 | T098 → T099
```

---

## Implementation Strategy

### MVP first

1. Phases 1–2 (contract and foundation): CHECKPOINT 2.
2. Phase 3 (US4 slots): CHECKPOINT 3.
3. Phase 4 (US1 booking flow): **STOP at CHECKPOINT 4 and demo.** The database constraint already prevents double-booking from Phase 2 onwards, even before the friendly race UX in US2.

### Incremental delivery

- +US2 (race UX and proof)
- +US3 (retries)
- +US6 (abuse)
- +US7 (privacy proof and retention)
- +US5 (entry points)
- Phase 10 polish

Each increment is shippable and keeps all earlier tests green.

---

## Notes

- Never put personal data in URLs, logs, test snapshots or fixtures. Use obviously fake values ("Zubair Testcase", 03123456789).
- Never run tests against the dev or prod database (Principle VII); seed and purge refuse production.
- Next.js 16 differs from older versions: check the bundled docs before using route handlers, `instrumentation.ts` or `useSearchParams`.
- Commit after each task or logical group, with the attribution lines from the session reminder.
