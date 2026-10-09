# Contract: Operational Endpoints (API)

These already exist (`backend/app/routers/health.py`). This feature **does not change** their responses; it fixes how they are used.

## GET /health — liveness
- **200** `{"status":"ok"}`, `Cache-Control: no-store`.
- Never touches the database. Exempt from rate limiting (`EXEMPT_PATHS`).
- Used by: UptimeRobot every 5 min.

## GET /ready — readiness
- **200** `{"status":"ok"}` when `SELECT 1` succeeds **and** `alembic_version.version_num` equals the code's head revision.
- **503** standard error body `service_unavailable` otherwise. Logs the error class only.
- Wakes Neon; rate-limited (60/min per IP).
- Used by: UptimeRobot **hourly** only; the smoke checklist after each deploy.

## Mounting rule (FR-079)
Both `/internal/maintenance/*` routes are mounted **only when `MAINTENANCE_VIA_CRON=true` and `CRON_SECRET` is set**. Otherwise they don't exist (404) and today's startup purge runs (local and tests only).

## POST /internal/maintenance/sentry-check — scrubbing verification (NEW, US3)
- Same auth and 404 rules as the purge route; not in the schema.
- Raises a deliberate error carrying **fake** personal data in headers and query, so Sentry scrubbing can be checked on the live API. Responds 500 with the standard error body.

## POST /internal/maintenance/purge — daily maintenance (NEW, condition C3)
- Called by Vercel Cron once a day (Hobby: ±59 min), schedule `0 21 * * *` UTC (≈ 02:00 Asia/Karachi). Vercel Cron issues a GET by default, so the route accepts **GET and POST**.
- Auth: `Authorization: Bearer <CRON_SECRET>`, constant-time compare. Missing or wrong → **404** (doesn't reveal the route). Not in the OpenAPI schema. Exempt from the per-IP limiter only when authorised.
- Work: the same bounded purge the startup hook did (demo bookings + audit when `DEMO_MODE`, old sessions always, expired rate-limit counters), **synchronously** within the request, with a time budget under 20 s.
- **200** `{"status":"ok","purged":<int>}`; **500** standard error body on failure (error class logged only). Re-running is harmless (idempotent).

## Production-only changes (from this feature)
- `/docs` stays hidden in production; **`/openapi.json` also returns 404 in production** (FR-066).
- Error responses never include stack traces or settings (unchanged).

## Acceptance checks
- [ ] `/health` returns 200 with Neon suspended, and Neon stays suspended.
- [ ] `/ready` returns 503 on a database one revision behind; 200 after `alembic upgrade head`.
- [ ] 61 `/health` calls in a minute → none are 429.
- [ ] `/openapi.json` → 404 with `APP_ENV=production`; 200 in development.
- [ ] `/internal/maintenance/purge` without or with a wrong bearer → 404; with the correct one → 200; old demo rows removed; a second call → 200 with `purged: 0`.
- [ ] App startup schedules no background task (lifespan creates no task or thread).
