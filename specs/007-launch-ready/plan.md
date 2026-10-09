# Implementation Plan: Launch Ready — First Live, Monitored, Safe Public Demo

**Branch**: `007-launch-ready` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-launch-ready/spec.md`
**Research**: [research.md](./research.md) · **ADR**: [ADR-0011](../../history/adr/0011-launch-hosting-and-deploy-strategy.md)

## Summary

This feature takes the existing product (Features 001–006) live as a **$0, non-commercial public demo**:

- **Hosting**: the website on **Vercel Hobby (`sin1`)**; the **FastAPI backend as a second Vercel project of Python Functions (`sin1`)** rather than Render, because the owner's Render workspace is already full with `kbg-backend` (research R1); Postgres on **Neon Free (Singapore)**.
- **Delivery**: CI on GitHub Actions with branch protection; migrations run in the API's production build; a guarded one-off seed and first admin.
- **Production settings**: production refuses to start or build when a required setting is missing.
- **Rate limiting**: fixed for trusted website traffic.
- **Monitoring and errors**: UptimeRobot monitoring and Sentry error tracking.
- **Backups**: daily encrypted backups to a private GitHub repo, with a restore drill.
- **Security**: security headers; npm audit cleaned up.
- **Docs**: runbooks.

There are no product features and no new database tables.

## Technical Context

**Language/Version**: Python 3.12 (backend, matches `requires-python >=3.12,<3.13`; Vercel default 3.12) · TypeScript 5 strict / Node 24.x (frontend)
**Primary Dependencies**: Existing: FastAPI, SQLModel, Alembic, psycopg 3, uv; Next.js 16.4 App Router. **New**: `sentry-sdk[fastapi]`, `@sentry/nextjs` (error tracking, R6). **New CI-only tools**: gitleaks, pip-audit, `age` (backups).
**Storage**: Neon Postgres. Production project in `aws-ap-southeast-1`: `main` branch for production, `preview` branch for Vercel previews. Dev stays in its separate existing project. CI uses a Postgres 16 service container.
**Testing**: pytest, Vitest, Playwright (existing). New: rate-limit trust tests, settings fail-closed tests, seed/admin target-guard tests, security-header and no-localhost assertions, CI build with a dead API.
**Target Platform**: Vercel Functions (Node for the website, Python for the API), region `sin1`; Neon Free; GitHub Actions; UptimeRobot Free; Sentry Free.
**Project Type**: Web app (existing `frontend/` + `backend/` monorepo), deployed as **two Vercel projects** from one repository (root dirs `frontend/` and `backend/`).
**Performance Goals**: Lighthouse mobile ≥ 90 (live, warm); API p95 < 1 s (catalog and booking, warm); cold start measured and shown as the friendly retry.
**Constraints**:
- $0 and no card anywhere.
- The `kbg-backend` Render service and its monitor stay untouched.
- Vercel Hobby (shared by both projects): 4 h Active CPU, 1M invocations, 360 GB-h memory, 100 GB transfer, 60 s max duration, 1 region, 1 h logs, non-commercial use.
- Neon Free: 100 CU-h per project per month, autosuspend after 5 min (fixed), 1 GB storage, 10 branches, 6 h restore window.
- The repo is public.

**Scale/Scope**: Public demo traffic of tens to low hundreds of visits a day; one clinic dataset; one owner-operator.

## Constitution Check

*Gate before Phase 0; re-checked after Phase 1 (below).*

| Principle | Status | Notes |
|---|---|---|
| I. Honesty | PASS | Demo labels unchanged. FR-075 removes any sales call to action, which keeps the site non-commercial and honest. |
| II. Privacy | PASS | Sentry scrubbing (R6); backups encrypted and private (R9); no personal data in logs or URLs; rate limits kept and fixed (R5). |
| III. Server truth | PASS / N/A | No domain logic changes. |
| IV. API-first | PASS | API contract unchanged; only operational endpoints are documented (contracts/ops-endpoints.md). |
| V. Resilience | PASS | CI adds an explicit `next build` with the API unreachable; the friendly retry covers cold starts. |
| VI. Security | PASS | BFF and same-origin design unchanged. CORS allow-list gets the production origin. Secrets live only in Vercel/GitHub/Neon dashboards. gitleaks runs in CI. Security headers site-wide. |
| VII. Databases | PASS | Pooled URL at runtime; direct URL for migrations; separate dev and prod projects; tests on a CI container only. |
| VIII. Design / a11y | PASS | No UI changes beyond removing any sales call to action (if one exists). Lighthouse is measured live. |
| IX. Quality | PASS | CI now enforces type-check, lint, unit and e2e on every PR. |
| X. Build order | PASS | This is Phase 4 (Deploy). |
| XI. Safe change | PASS | Own branch; no migrations in this feature. Each new behaviour sits behind a flag that is **OFF in code and ON explicitly in production** (FR-079; see "Feature flags" below). Endpoints with secrets stay off without their secret. Existing tests are guarded unchanged: T011 for retention, T107/T108 for rate limits. Merges happen only through the owner's merge click, with all four required checks green. |
| **Tech Stack & Deployment** | ✅ RESOLVED | The deviation (backend on Vercel, not Render) was approved by the owner on 2026-10-09; constitution amended to 1.2.0. |

## Key Decisions (detail in research.md, ADR-0011)

1. **API on Vercel Python Functions, separate project, `sin1`** (R1). Render isn't used for the clinic.
2. **Migrations in the API's production and preview builds**, gated on `VERCEL_ENV` being `production` or `preview`, each using its own environment's direct URL with a bounded wait for Neon to wake (R3).
3. **Previews use a Neon `preview` branch**; production secrets are scoped to the Production environment only (R8).
4. **Trusted website traffic skips the shared per-IP bucket**; visitor IP taken from the platform header; proxy hops measured (R5).
5. **Daily encrypted backups to a private GitHub repo, 14 days**; Drive copy is manual and monthly (R9).
6. **Sentry Free** for errors; **UptimeRobot**: liveness checks every 5 min, DB-touching checks hourly (R6, R7).
7. **CI**: four required jobs (e2e included, with no optional fallback) plus branch protection with 0 approvals; the owner's merge click is the approval (R10).

## Owner conditions on ADR-0011 (approved 2026-10-09)

The owner approved the backend on Vercel with four binding conditions. Each was checked against the current code:

| # | Condition | Current code (inspected) | Plan |
|---|---|---|---|
| C1 | Neon **pooled** URL with small, serverless-safe pool settings | `backend/app/db.py` `make_engine`: already uses the pooled URL with `prepare_threshold=None` (PgBouncer transaction mode), but **`pool_size=5, max_overflow=5` per instance**; `pool_pre_ping=True`; `pool_recycle=300`; `connect_timeout=10` | New settings `DB_POOL_SIZE` (default **1**), `DB_MAX_OVERFLOW` (default **1**), `DB_POOL_TIMEOUT` (default **5 s**). Keep `pool_pre_ping`, `pool_recycle=300`, `connect_timeout=10` (covers the Neon wake). A startup check refuses a non-`-pooler` host for `DATABASE_URL` in production (Constitution VII). The direct URL is used by migrations only. |
| C2 | Rate limiting and lockout use **shared state**, not process memory | Login lockout (`auth/throttle.py`), login-IP, booking, lookup and demo-start limits **already use Postgres** (`rate_limit_counter` / lockout rows, ADR-0006). **Only** the global per-IP middleware uses `InMemoryFixedWindowLimiter` (`app/main.py:122`, `middleware/rate_limit.py`) | Add `PostgresFixedWindowLimiter` implementing the existing `RateLimiter` protocol (same atomic `INSERT … ON CONFLICT` as `booking/limits.py`, HMAC-keyed buckets) and wire it in **all environments**. The in-memory class and its tests stay (no deleted tests) but it is no longer wired. Combined with R5: `/health` stays exempt; trusted website requests without a visitor IP are exempt, so ISR and builds don't write counters. **Vercel KV / Edge Config rejected**: KV is no longer a first-party Vercel product (now a Marketplace integration, i.e. another account), and Edge Config is built for reads, not per-request counter writes. |
| C3 | **No background threads or long-running tasks** inside functions | ① `app/main.py` `lifespan`: `asyncio.create_task(asyncio.to_thread(_startup_purge…))` is a **background thread at startup**, awaited only at shutdown (Vercel allows 500 ms for shutdown). ② `booking/service.py` `_purge_after_booking`: inline, bounded, inside the request. OK. ③ `booking/limits.cleanup_counters` / `throttle.cleanup`: inline, bounded. OK. ④ `lru_cache` uses (settings, engine, hasher, head revision, demo generator) are pure memoisation, not tasks. OK. ⑤ Sentry Python SDK sends events from its own worker thread. ⑥ Frontend `setInterval`/`setTimeout` exist only in browser-side admin state (`src/admin/state/*`). Not server functions. OK. | ① Remove the startup background purge. Replace it with a **Vercel Cron Job (Hobby: once a day, ±59 min)** on the API project calling `POST /internal/maintenance/purge`, which runs the same bounded purge **synchronously** and is authorised by `Authorization: Bearer $CRON_SECRET` (constant-time compare, 404 without it, excluded from the OpenAPI schema). The per-booking inline purge remains as a backstop. ⑤ Sentry: capture only from the exception handler and call `sentry_sdk.flush(timeout=2)` **before the response returns**, so no event depends on work after the request; the SDK's worker never has queued work once a request ends. Sentry Next.js uses the platform's `waitUntil`. |
| C4 | **Measure Python cold start on a preview deploy** against the speed promise | — | New task in Phase 4/5: on the first API **preview** deployment, after ≥ 30 min idle (function cold, Neon suspended), measure 5 samples each of: `/health` cold, `/ready` cold (includes the Neon wake), catalog GET cold, and the same warm. Record p50/max in `results/cold-start.md` against the targets: warm p95 < 1 s; cold must show the friendly retry, never a blank error, and the cold catalog fetch must finish inside the website's BFF timeout. If cold `/ready` > BFF timeout, raise the BFF timeout for first-load paths or narrow the cron/monitor schedule before production. |

**C2 failure mode (owner decision, 2026-10-09)**: if the database is unreachable, **only** the general per-IP limiter lets requests through, and it logs the error class. Booking, login, lookup and demo-start limits keep blocking (ADR-0006 behaviour unchanged).

## Feature flags (Constitution XI, owner decision K2)

All flags are **OFF in code**. Production (and preview, which runs `APP_ENV=production`) MUST set each one explicitly; a missing value is a startup or build error naming the flag.

| Flag | Tier | OFF (code default) | ON (production value) | Covers |
|---|---|---|---|---|
| `RATE_LIMIT_STORE` | API | `memory` (today's behaviour) | `postgres` | C2 |
| `TRUSTED_SERVER_EXEMPT` | API | `false`: website requests count like any client | `true`: valid secret without visitor IP is exempt; with `X-Client-IP`, keyed on the visitor | B3 / R5 |
| `MAINTENANCE_VIA_CRON` | API | `false`: today's startup purge (local only) | `true`: no startup task; cron endpoint mounted (also needs `CRON_SECRET`) | C3 |
| `SITE_SECURITY_HEADERS` | website | `off` | `report` at launch → `enforce` after one clean release (env change and redeploy, no code PR) | FR-065 |

Kill switch (playbook rule 7, infrastructure-flag note): change the value and redeploy (~1–2 min), or use Vercel Instant Rollback to an earlier deployment where the flag was off. `MAINTENANCE_VIA_CRON=false` is **not** a valid production value under C3; its runbook rollback is "keep ON, disable the cron".

Endpoints with secrets: `/internal/maintenance/purge` and `/internal/maintenance/sentry-check` are mounted only when `MAINTENANCE_VIA_CRON=true` **and** `CRON_SECRET` is set. Sentry is off without `SENTRY_DSN`; the preview protection bypass is off without `API_PROTECTION_BYPASS`.

## Preview environment (fixes H3, H4)

- **Database**: the Neon `preview` branch is created **immediately after the project, while it is still empty**, before any migration or seed. It never holds production data (playbook §2). Because Neon copies roles into child branches, the app role's password is **reset on the preview branch** (branch-scoped), so preview and production credentials differ (Constitution VII). It is seeded with demo data through the guarded seed (T109).
- **CI gates added for constitution tests**: a `.gitignore` check in `secrets` (VI, T113) and Lighthouse CI budgets in `e2e` (VIII, T114).
- **Migrations**: the API build runs `alembic upgrade head` when `VERCEL_ENV` is `production` **or** `preview`, each against its own `DIRECT_DATABASE_URL`.
- **Deployment Protection**: Vercel protects preview URLs by default. The owner enables **Protection Bypass for Automation** on the API project and stores the value as `API_PROTECTION_BYPASS` in the website's **Preview** env only. Website server-side fetches send `x-vercel-protection-bypass` when it is set (server-only; never in client bundles). Availability on Hobby is verified in T110; if it is missing, previews use Vercel Authentication and the C4 measurement uses a bypass token shared by the owner.

## Lighthouse and noindex (fix H1)

Live: Performance, Accessibility and Best Practices ≥ 90. SEO ≥ 90 is checked on a **test-only `indexable=true` local production build** (T112), following the standing rule that the demo stays noindex and a low live SEO score is expected.

## Merge gate (fix H2, owner decision)

Branch protection: 4 required checks (backend, frontend, secrets, e2e, all required with no optional fallback, K1), up-to-date branches, no force-push or deletion, administrators included (no bypass), **0 required approvals**. PRs are authored from the owner's account, and GitHub forbids self-approval, so the owner's merge click is the approval (playbook rule 6).

**Constitution**: amended to 1.2.0 (backend hosted on Vercel Functions; Render only for legacy/other projects). The Tech Stack deviation row in Complexity Tracking is resolved.

**New settings from the conditions**: `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT` (API, optional with safe defaults); `CRON_SECRET` (API, secret, required in production). Added to contracts/required-settings.md.

**Money rule (approved)**: billing is never enabled on any host. If a free allowance runs out, the demo pauses until month end, and the runbook says so.

## Phases (for `/sp.tasks`)

| Phase | Content | Spec refs |
|---|---|---|
| **0. Governance** | Constitution amendment (backend host); ADR-0011 accepted | FR-074 |
| **1. Repo hardening (code, local only)** | Fail-closed production settings (demo switches, `SITE_URL` / `VERCEL_PROJECT_PRODUCTION_URL`); rate-limit trust fix + tests; `clientIpFrom` header order; site-wide security headers (CSP Report-Only); hide `/openapi.json` in production; seed/admin target guard; Sentry wiring (DSN-gated, scrubbed); npm audit fixes + allow-list; pip-audit | FR-020–023, 030–034, 061–066, 013–015, 052 |
| **2. Deploy config + CI** | `backend/vercel.json` (`regions`, `functions.maxDuration`, `excludeFiles`) + `pyproject` `[tool.vercel]` entrypoint and build script (migrate in production and preview builds); `frontend/vercel.json` (`regions: ["sin1"]`); `.github/workflows/ci.yml`; `.gitleaks.toml`; PR template update; `.env.example` sync | FR-001–005, 010–012, 040–045 |
| **3. Runbooks** | `docs/runbooks/`: first-deploy, deploy, rollback, incident-note template, new-env-var checklist, restore-drill, free-tier-usage, secret-rotation, custom-domain-prep, plan-fit note | FR-024, 071–073, 075 |
| **4. Owner-run launch** *(the owner creates accounts and clicks; Claude guides)* | Create the Neon project, branches and read-only role; create the two Vercel projects and env vars; first deploy; run seed and admin; measure XFF and set hops; branch protection; UptimeRobot + Sentry + deploy notifications; backups repo + first backup | FR-002, 013, 031, 042, 050–059 |
| **5. Verification** | Smoke checklist on live + real phone; Lighthouse; p95; cold-start measure; restore drill; rollback rehearsal; 7-day usage projection | FR-058, 060, 067–070, SC-001–012 |

## Spec alignment with ADR-0011

The spec was amended on 2026-10-09: FR-004 is N/A; FR-005 covers previews; FR-034 is shared state with the agreed failure mode; FR-041/042 cover the merge gate; FR-051 covers monitors; FR-067/SC-002 cover Lighthouse; FR-076–079 cover C1, C3, C4 and the flags. Its Render constraint row now points at ADR-0011. FR-001 is met by `backend/vercel.json` plus the `pyproject` Vercel settings (no `render.yaml`). FR-011 is met by a failed build leaving the previous deployment live.

## Project Structure

### Documentation (this feature)

```text
specs/007-launch-ready/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R13
├── data-model.md         # operational entities (settings, environments, monitors, backups)
├── quickstart.md         # first-deploy walkthrough (owner-run)
├── contracts/
│   ├── ops-endpoints.md      # /health, /ready behaviour contract
│   ├── required-settings.md  # every env var × environment × host
│   └── ci-checks.md          # required CI jobs and pass criteria
├── checklists/requirements.md
├── results/              # Lighthouse, p95, cold start, drill, phone QA (Phase 5)
└── tasks.md              # /sp.tasks
```

### Source Code (repository root) — files expected to change or be added

```text
.github/
├── workflows/ci.yml                 # NEW
└── pull_request_template.md         # updated: runbook links, migration restore-point item, no-sales check
.gitleaks.toml                       # NEW
docs/runbooks/*.md                   # NEW
backend/
├── vercel.json                      # NEW (regions sin1, maxDuration, excludeFiles)
├── pyproject.toml                   # [tool.vercel] entrypoint + build script; sentry-sdk
├── scripts/vercel_build.py          # NEW: migrate when VERCEL_ENV is production or preview, bounded retry
├── app/settings.py                  # fail-closed demo switches in production
├── app/main.py                      # openapi_url None in production; Sentry init (DSN-gated)
├── app/middleware/rate_limit.py     # trusted-secret requests: visitor key or exempt
├── app/seed/…, app/auth/create_admin.py  # target guard
└── tests/…                          # new tests only
frontend/
├── vercel.json                      # NEW (regions sin1)
├── next.config.ts                   # site-wide security headers
├── src/lib/seo.ts (+ site URL source)   # production guard, VERCEL_PROJECT_PRODUCTION_URL fallback
├── src/lib/…/clientIp               # header preference order
├── src/lib/api/… catalog fetch      # send proxy secret (+ visitor IP when present)
├── sentry.*.config.ts, instrumentation.ts   # Sentry (DSN-gated)
├── package.json                     # overrides for audit; @sentry/nextjs
├── audit-allowlist.json             # NEW (only if needed)
└── tests/…                          # new tests only
```

**Structure Decision**: Keep the existing `frontend/` + `backend/` monorepo, deployed as two Vercel projects with Root Directory set to each folder. A separate private repo `shuaib-health-backups` holds only the backup workflow (no app code).

## Risks (top 3)

1. **Shared Hobby allowance runs out → both projects paused until month end.** Blast radius: the whole demo. Guardrails: weekly usage check, ≤ 80% projection, Neon compute pinned at 0.25 CU, hourly (not 5-minute) DB checks. Kill switch: pause monitors, or temporarily move the API to Render as a sleeping service (the burger site is unaffected only if total hours stay ≤ 750; runbook gives the math).
2. **A migration fails in the build, or a non-additive migration breaks rollback.** Guardrails: additive-only rule, restore point before merge, CI up/down/up, the old deployment stays live on failure.
3. **The Vercel Hobby commercial-use line gets crossed.** Guardrail: FR-075 checklist item; move to Pro before the first paying client.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Backend on Vercel instead of Render (constitution Tech Stack / Phase 4) | Render's free hours are per workspace and already used by `kbg-backend`; going over suspends **all** free services, including the burger site | Render same workspace (suspends both); a second Render workspace (terms risk to the owner's whole account); Koyeb / Cloud Run / Oracle (card, region or ops — R1c) |
| New runtime deps `sentry-sdk`, `@sentry/nextjs` | Hobby keeps logs only 1 hour; FR-052 needs error capture with scrubbing | Logs only (lost after 1 hour); self-hosted GlitchTip (ops burden) |
| Separate private backups repo | Public repo artifacts are readable by any signed-in GitHub user; FR-056 requires private storage | Google Drive automation (OAuth refresh-token risk and expiry, R9); the public repo's own artifacts |

## Post-Design Constitution Re-check

Every principle is PASS, with one deviation: the Tech Stack host change is justified above and needs the constitution amendment before `/sp.tasks`. No new tables or migrations. Design artifacts add no new user-facing behaviour.
