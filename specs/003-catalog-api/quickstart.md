# Quickstart: Backend (Windows CMD)

**Feature**: 003-catalog-api. This becomes the backend section of the README (FR-083).

## Prerequisites

- `uv` 0.9+ (`uv --version`). uv installs Python 3.12 itself if needed.
- Two Neon databases with separate credentials: **dev** and **test** (a Neon branch is fine). From the Neon console copy, for dev, the **pooled** URL (host contains `-pooler`) and the **direct** URL; for test, its direct URL is enough.
- Node 24 only if you regenerate the seed JSON from the frontend mocks.

## 1. Install

```bat
cd backend
uv sync
```

## 2. Configure

```bat
copy .env.example .env
notepad .env
```

Fill in (never commit `.env`; it is git-ignored):

| Variable | Example (placeholder) | Notes |
|----------|----------------------|-------|
| `APP_ENV` | `development` | `development` \| `test` \| `production` |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require` | pooled; used by the app |
| `DIRECT_DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require` | direct; used by Alembic |
| `TEST_DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@ep-yyy.REGION.aws.neon.tech/DB_TEST?sslmode=require` | must differ from both above |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated; `*` is rejected |
| `RATE_LIMIT_PER_MINUTE` | `60` | per client IP |
| `TRUSTED_PROXY_HOPS` | `0` | set >0 only behind a known proxy |
| `CACHE_MAX_AGE_SECONDS` | `300` | catalog `Cache-Control` |
| `IMAGE_BASE_PATH` | `/images/` | prefix for image keys |
| `LOG_LEVEL` | `INFO` | |

The app refuses to start (and names the bad setting, not its value) if a URL lacks `sslmode=require`, the pooled/direct URLs are swapped, or the test URL equals a dev URL.

## 3. Migrate and seed

```bat
uv run alembic upgrade head
uv run python -m app.seed
```

Run the seed again any time; it never duplicates. It refuses when `APP_ENV=production`.

## 4. Run

```bat
uv run uvicorn app.main:app --reload --port 8000 --no-access-log
```

Check:

```bat
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -s "http://localhost:8000/api/v1/doctors?department=cardiology&pageSize=5"
curl -s http://localhost:8000/api/v1/doctors/dr-hassan-mirza
curl -s "http://localhost:8000/api/v1/lab-tests?q=hba1c"
```

Interactive docs (development only): http://localhost:8000/docs

## 5. Quality checks

```bat
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
uv run pytest -m perf
```

`pytest` runs unit tests always; database tests run only when `TEST_DATABASE_URL` is set (otherwise they are reported as skipped with the reason). The migration test downgrades and upgrades the **test** database only.

## 6. Regenerate seed data from the frontend mocks (only when mocks change)

```bat
cd ..\frontend
node scripts\export-catalog.mts
npm test -- catalog-export
```

## Acceptance walk-through

- [ ] `/health` 200; `/ready` 200 with DB up, 503 with a wrong password in `DATABASE_URL`
- [ ] `/api/v1/departments` returns 7 items, `/doctors` 9, `/lab-tests?pageSize=100` 26, `/health-packages` 5, `/lab-test-categories` 9, `/clinic/rules` 5
- [ ] `/api/v1/doctors/nope` → 404 `{ "error": { "code": "not_found", ... } }`
- [ ] `/api/v1/doctors?pageSize=500` → 422 naming `pageSize`
- [ ] Repeat `curl` with `-H "If-None-Match: <etag>"` → 304
- [ ] 61 requests in a minute → 429 with `Retry-After`
- [ ] Response headers include `X-Request-ID`, `X-Content-Type-Options`, `Content-Security-Policy`
- [ ] Running the seed 3× leaves the same counts
