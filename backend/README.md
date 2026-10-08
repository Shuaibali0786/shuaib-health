# Shuaib Health backend

Read-only clinic catalog API (FastAPI + SQLModel + Alembic + psycopg 3, run with `uv`, data in
Neon Postgres). It serves the clinic's public catalog (clinic details, rules, departments,
doctors with weekly schedules, lab tests, health packages) to the website, and later to the
booking flow, staff app and AI agent, through one versioned API.

> **Portfolio demo — not a real clinic, not medical advice.** All seeded data is sample data.
> Designed & built by [Shuaib Ali](https://github.com/Shuaibali0786).

Nothing about the clinic is hard-coded: name, logo, colours, phones, hours, the demo notice and
the clinic rules all come from the database. One database serves one clinic.

The catalog endpoints are read-only. Feature 005 adds online appointment booking (slots, create, lookup), described below.
See [`specs/003-catalog-api/`](../specs/003-catalog-api/) and [`specs/005-appointment-booking/`](../specs/005-appointment-booking/) for the specs, plans, data models and the
OpenAPI contract, and [`history/adr/`](../history/adr/) for the architecture decisions.

All commands below are for **Windows CMD**, run from the `backend` folder.

## 1. Prerequisites

- [`uv`](https://docs.astral.sh/uv/) (`uv --version`). It installs Python 3.12 by itself.
- Two Neon databases with **separate credentials**: a **dev** database and a **test** database
  (a second Neon branch is fine). From the Neon console copy:
  - dev **pooled** URL (host contains `-pooler`),
  - dev **direct** URL (same database, host without `-pooler`),
  - test **direct** URL.
- Node 24 only if you regenerate the seed data from the frontend mock files.

## 2. Install

```bat
cd backend
uv sync
```

## 3. Configure

```bat
copy .env.example .env
notepad .env
```

`.env` is git-ignored. Never commit it and never paste real URLs into chats, issues or logs.

| Variable | Meaning |
|----------|---------|
| `APP_ENV` | `development`, `test` or `production`. API docs are served only in `development`. The seed refuses `production`. |
| `DATABASE_URL` | Dev database, **pooled** URL. Used by the running app. |
| `DIRECT_DATABASE_URL` | Dev database, **direct** URL. Used by Alembic migrations. |
| `TEST_DATABASE_URL` | A **separate** database for tests. **The tests wipe it.** |
| `CORS_ORIGINS` | Comma-separated browser origins that may call the API. `*` is rejected. |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute per client IP (default 60). |
| `TRUSTED_PROXY_HOPS` | Trusted reverse proxies in front of the app (default 0: ignore `X-Forwarded-For`). |
| `CACHE_MAX_AGE_SECONDS` | `Cache-Control` max-age for catalog responses (default 300). |
| `IMAGE_BASE_PATH` | Prefix joined to stored image keys (default `/images/`). |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING` or `ERROR`. |
| `BOOKING_PROXY_SECRET` | **Required**, at least 32 characters. Shared with the website (its `BOOKING_PROXY_SECRET`); bookings are accepted only with it. The app refuses to start without it. |
| `PRIVACY_HASH_KEY` | **Required**, at least 32 characters. Key for the one-way hashes of IPs, mobiles and idempotency keys. The app refuses to start without it. |
| `DEMO_MODE` | `true` (default): bookings are labelled as samples. |
| `DEMO_ENABLED` | `true` (default): the read-only demo dashboard. `false` for a real clinic: `POST /admin/demo/start` answers 404 and no demo session can read anything. The website reads the same name (set it before `next build`). Outside clinic hours (09:00-20:00 Karachi) the demo shows its sample day as it stands at 12:30 and labels it. |
| `BOOKING_PURGE_AFTER_DAYS` / `AUDIT_PURGE_AFTER_DAYS` | Retention of demo bookings (default 7, 1–90) and audit rows (default 90, 7–365). |
| `BOOKING_LIMIT_PER_IP_PER_HOUR` / `BOOKING_LIMIT_PER_PHONE_PER_DAY` / `LOOKUP_LIMIT_PER_IP_PER_MINUTE` | Booking limits (defaults 10, 5, 20). |

Generate each secret with `python -c "import secrets; print(secrets.token_urlsafe(32))"`.

URL format: `postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require`. Neon shows
`postgresql://...`; change the start to `postgresql+psycopg://`.

The app refuses to start, naming the setting but never its value, when a URL is not
`postgresql+psycopg://`, lacks `sslmode=require`, the pooled/direct URLs are swapped, the test
URL equals a dev URL, or a CORS origin is `*` or malformed.

## 4. Create the tables and load the sample data

```bat
uv run alembic upgrade head
uv run python -m app.seed
```

The seed is safe to run any number of times: it updates sample records by slug, keeps their
IDs, and never touches rows it does not own. It refuses to run when `APP_ENV=production`.

## 5. Run

```bat
uv run uvicorn app.main:app --reload --port 8000 --no-access-log
```

(`--no-access-log` turns off uvicorn's own log, which would print query strings; the app writes
its own JSON access log without them.)

```bat
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -s "http://localhost:8000/api/v1/doctors?department=cardiology&pageSize=5"
curl -s http://localhost:8000/api/v1/doctors/dr-hassan-mirza
curl -s "http://localhost:8000/api/v1/lab-tests?q=hba1c"
```

Interactive docs (development only): <http://localhost:8000/docs>. The machine-readable
contract is at `/openapi.json` and is checked against
[`specs/003-catalog-api/contracts/openapi.yaml`](../specs/003-catalog-api/contracts/openapi.yaml)
by a test.

### Endpoints (`/api/v1`, all `GET`)

| Path | Notes |
|------|-------|
| `/clinic`, `/clinic/rules` | White-label settings; active rules in order |
| `/departments`, `/departments/{slug}` | |
| `/doctors`, `/doctors/{slug}` | Filters `department` (slug), `q` (name), `day` (`mon`..`sun`); detail has the weekly schedule |
| `/lab-test-categories` | |
| `/lab-tests`, `/lab-tests/{slug}` | Filters `q` (name or also-known-as), `category` (slug) |
| `/health-packages`, `/health-packages/{slug}` | Detail includes the included tests |
| `/health`, `/ready` (no prefix) | Liveness; database reachable and migrations at head |

Lists return `{ "items": [...], "total": n, "page": 1, "pageSize": 20 }` (`page` 1-10000,
`pageSize` 1-100). Every error has one shape:
`{ "error": { "code", "message", "requestId", "details?" } }` with codes `not_found` (404),
`method_not_allowed` (405), `validation_error` (422), `rate_limited` (429, with `Retry-After`),
`internal_error` (500), `service_unavailable` and `not_configured` (503). Catalog responses
carry `ETag` and `Cache-Control`; send `If-None-Match` to get `304`.

### Booking endpoints (Feature 005)

| Path | Notes |
|------|-------|
| `GET /doctors/{slug}/slots` | Query `from` (date) and `days` (1-60). Slots in clinic time with leave, holidays and bookings applied. `Cache-Control: no-store` |
| `POST /appointments` | Needs `X-Proxy-Secret` (the website sends it) and an `Idempotency-Key` (UUID v4). `201` with a masked view; `409` `slot_taken`, `slot_unavailable`, `booking_limit_reached` or `idempotency_key_reused`; `400` `request_rejected` (honeypot); `403`; `422`; `429` with `Retry-After` |
| `GET /appointments/{reference}` | Masked view (no email, no reason). An unknown reference is always the same `404` |

- **Fail fast.** The app (and `python -m app.seed`) refuses to start without `BOOKING_PROXY_SECRET` and `PRIVACY_HASH_KEY`, each at least 32 characters. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. The value is never printed.
- **No double booking.** A Postgres exclusion constraint (`ex_appointment_no_overlap`, ADR-0005) is the final guard; the loser of a race gets `409 slot_taken` with up to 5 alternatives.
- **Retention (demo).** Bookings are deleted 7 days after the appointment ended and audit rows after 90 days, at startup and on the next booking. Run it by hand with `uv run python -m app.booking.purge` (refuses when `DEMO_MODE` is false).
- **Concurrency proof.** `uv run pytest -k concurrency` runs the 20-thread race. `uv run pytest -m perf tests/perf/test_booking_concurrency_repeat.py -s` repeats it 100 times (SC-002); it needs `TEST_DATABASE_URL` and took about 13 minutes against the remote test database.

## 6. Quality checks

```bat
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
uv run pytest -m perf -s
```

- Unit tests run anywhere. Database tests (marked `db`) run against `TEST_DATABASE_URL` and are
  **skipped with a reason** when it is not set. The test suite migrates the test database from
  scratch, seeds it, and rolls back every test.
- `pytest -m perf -s` prints server-side latency per endpoint (budget: p95 under 200 ms). Most of
  the time is the network round trip to the database, so results depend on how far you are
  from the Neon region.
- **One pytest run at a time.** The suite drops and re-creates every table in the test database, so
  two runs at once would wreck each other. Each run takes a Postgres advisory lock on the test
  database for its whole session; a second run prints "Waiting: another pytest run is using the
  test database" and starts when the first ends (it gives up after 15 minutes). The Playwright
  and Vitest suites use a mock API and never touch the database, so they are not affected.
- `mypy` also checks `migrations/` (configured in `pyproject.toml`).

## 7. Regenerate the seed data (only when the frontend mock data changes)

The seed file `app/seed/data/catalog.json` is exported from the frontend catalog fixtures in
`frontend/tests/fixtures/catalog/` (built by `frontend/scripts/catalog-object.mjs`). The website
no longer reads those files at runtime; it reads this API. A frontend test fails when the
fixtures and the seed file differ.

```bat
cd ..\frontend
npm run export:catalog
npm test -- catalog-export
```

## Security and privacy baseline

Strict CORS allow-list (GET only, no credentials), security headers on every response, per-IP
rate limiting, a request ID on every request (`X-Request-ID`, also in logs and error bodies),
structured JSON logs that only contain allow-listed fields (no query strings, no personal or
medical data, no connection strings), SSL-only database connections, secrets only from the
environment, and no stack traces, SQL or input values in error responses. The in-memory rate
limiter is per process; use a shared store before running more than one instance.

## Troubleshooting

- **`Field required` / a setting error on startup**: `.env` is missing or a value is invalid;
  the message names the setting. Compare with `.env.example`.
- **`/ready` returns 503**: the database is unreachable or migrations are not at head. Run
  `uv run alembic upgrade head`. Neon free databases suspend when idle; the first request after
  a pause can take a few seconds.
- **`/api/v1/clinic` returns 503 `not_configured`**: the database has no clinic settings. Run
  `uv run python -m app.seed`.
- **Database tests are skipped**: set `TEST_DATABASE_URL` in `.env`.
