# Contract: Required Settings by Host and Environment

Names only, never values. **S** = secret (dashboard only). **Prod-req** = missing value is a startup or build error in production.

## API project (Vercel, root `backend/`)

| Setting | S | Prod-req | Production | Preview | Notes |
|---|---|---|---|---|---|
| `APP_ENV` | | yes | `production` | `production` | |
| `DATABASE_URL` | S | yes | Neon `main` **pooled** | Neon `preview` pooled | `sslmode=require`. Preview uses a **different role password** (reset on the preview branch after branching), so a preview credential can't open production. |
| `DIRECT_DATABASE_URL` | S | yes | Neon `main` direct | Neon `preview` direct | migrations in production **and** preview builds, each against its own branch |
| `BOOKING_PROXY_SECRET` | S | yes | ≥ 32 chars | different value | must equal the website value in the same environment |
| `PRIVACY_HASH_KEY` | S | yes | ≥ 32 chars | different value | rotating it changes fingerprints |
| `SESSION_SECRET` | S | yes | ≥ 32 chars | different value | rotating it signs everyone out |
| `CORS_ORIGINS` | | yes (prod) | production website origin | preview origin pattern not allowed; the BFF doesn't need it | no `*`, no trailing slash |
| `TRUSTED_PROXY_HOPS` | | — | **measured** (R5) | same | |
| `DEMO_MODE` | | **yes (new)** | `true` | `true` | fail-closed (FR-020) |
| `DEMO_ENABLED` | | **yes (new)** | `true` | `true` | must match the website |
| `SENTRY_DSN` | S | no | API Sentry DSN | unset or same | unset = Sentry off |
| `RATE_LIMIT_STORE` | | **yes (flag)** | `postgres` | `postgres` | code default `memory` (C2) |
| `TRUSTED_SERVER_EXEMPT` | | **yes (flag)** | `true` | `true` | code default `false` (B3) |
| `MAINTENANCE_VIA_CRON` | | **yes (flag)** | `true` | `true` | code default `false`; `false` isn't valid in production (C3) |
| `CRON_SECRET` | S | **yes (new)** | ≥ 32 chars | different value | Vercel Cron sends it as a Bearer token to `/internal/maintenance/purge` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_TIMEOUT` | | no | 1 / 1 / 5 | same | serverless-safe pool (condition C1) |
| `LOG_LEVEL`, limit tunables | | no | defaults | defaults | |
| `TEST_DATABASE_URL` | | **must be unset** | — | — | tests wipe it |

## Website project (Vercel, root `frontend/`)

| Setting | S | Prod-req | Production | Preview | Notes |
|---|---|---|---|---|---|
| `CATALOG_API_URL` | | yes | API production URL (https) | API preview URL or prod-preview alias | |
| `BOOKING_PROXY_SECRET` | S | yes | = API prod | = API preview | |
| `SITE_URL` | | yes, or derived | production https URL | unset → `VERCEL_URL`-derived | build fails in prod if neither it nor `VERCEL_PROJECT_PRODUCTION_URL` exists |
| `DEMO_ENABLED` | | **yes (new)** | `true` | `true` | build-time; changing it needs a redeploy |
| `SITE_SECURITY_HEADERS` | | **yes (flag)** | `report` at launch → `enforce` | `report` | code default `off`; switching needs a redeploy (FR-065) |
| `API_PROTECTION_BYPASS` | S | no | **unset** | API project's "Protection Bypass for Automation" value | Preview scope only; sent as `x-vercel-protection-bypass` from server code |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | S | no | website DSN / source-map upload token | optional | |
| `CLINIC_FALLBACK_JSON` | | no | optional | optional | |
| `CATALOG_DATA_REVALIDATE_SECONDS`, `NEXT_DIST_DIR` | | **must be unset** | — | — | test-only |

## GitHub (main repo) Actions secrets
None required for CI (tests use the service container; Sentry off).

## GitHub (`shuaib-health-backups`, private) Actions secrets
| Setting | S | Notes |
|---|---|---|
| `NEON_BACKUP_URL` | S | **read-only** role, direct host |
| `AGE_RECIPIENT` | | owner's age **public** key (not secret) |

## Acceptance checks
- [ ] `.env.example` files list every setting above (placeholders only).
- [ ] A production-mode start or build with any Prod-req setting missing fails, naming it.
- [ ] Preview and production values differ for every secret.
