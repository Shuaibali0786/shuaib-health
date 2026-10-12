# Preview deploy: smoke checks and warm latency (2026-10-12)

Branch `docs/neon-branch-name` (PR #13). Both Vercel projects built a **Preview** only; production is held (ignored build step). The preview database is migrated but **not seeded yet** (T109, owner action), so catalog pages show the "temporarily unavailable" state.

## Deployments
| Project | Environment | Region | Result |
|---|---|---|---|
| shuaib-health-api | Preview | sin1 | Ready. Build log: "vercel_build: migrations are at head" |
| shuaib-health-web | Preview | sin1 | Ready (rebuilt after `CATALOG_API_URL` was set for this branch) |
The very first Git deployment of each project was created as **Production** by Vercel (it does this for a new project whatever the branch); the production hold cancelled both after about 18 s. Nothing went live.

## API preview checks (with the automation bypass token; token never printed)
| Check | Result |
|---|---|
| `/health` | 200 |
| `/ready` | 200 (database reachable, migrations at head) |
| `/api/v1/clinic` | 503 `not_configured` (expected: database not seeded) |
| `/openapi.json`, `/docs` | 404 (hidden in production mode) |
| `/health` without bypass | 302 to Vercel login (Deployment Protection works) |
| Headers | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` present |

## Website preview checks
| Check | Result |
|---|---|
| `/`, `/doctors`, `/lab-tests`, `/book-appointment`, `/about`, `/faq`, `/admin/login`, `/robots.txt`, `/sitemap.xml` | all 200 |
| Security headers on `/` | HSTS (no preload), nosniff, `X-Frame-Options: DENY`, Permissions-Policy, Referrer-Policy, CSP **Report-Only** (`SITE_SECURITY_HEADERS=report`) |
| `/admin/login` | keeps its own `no-store`, `noindex`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: frame-ancestors 'none'` |
| robots.txt | `Disallow: /` (demo is not indexable) |
| canonical and sitemap | https preview address only; `localhost` appears 0 times in the home HTML |
| `X-Robots-Tag: noindex` on `/` | added by Vercel for preview deployments; production uses the clinic's `indexable` flag |

## Warm latency from the owner's laptop (`backend/scripts/measure_latency.py`)
| Path | n | p50 | p95 | max | Status |
|---|---|---|---|---|---|
| `/health` | 20 | 294 ms | 639 ms | 729 ms | 200 x20 |
| `/ready` | 20 | 315 ms | 347 ms | 642 ms | 200 x20 |
| `/api/v1/clinic` | 10 | 309 ms | 334 ms | 334 ms | 503 x10 (not seeded) |
Target: warm p95 under 1 s. `/health` and `/ready` meet it. The catalog number is meaningless until the preview is seeded.

## Not done yet (blocked, not failed)
- **Cold-start gate (T059, C4):** needs at least 30 minutes idle and a seeded preview database (the catalog GET is part of the gate).
- **Booking end to end and demo dashboard:** need the seeded preview data.
- **Seed of the preview database (T109):** owner action; it needs the preview database URL, which only the owner holds.
