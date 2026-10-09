# ADR-0011: Launch Hosting and Deploy Strategy

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted (owner, 2026-10-09), with conditions C1–C4 below; constitution amended to 1.2.0
- **Date:** 2026-10-09
- **Feature:** 007-launch-ready
- **Context:**
  - This is the first real deployment: a **$0, card-free, non-commercial public demo** with the speed promise (Lighthouse mobile ≥ 90, API p95 < 1 s, no visitor-facing cold start beyond the friendly retry).
  - The constitution and the audit assumed Vercel + Render + Neon in Singapore.
  - Render's free tier gives **750 instance hours per workspace** per month and suspends *all* free services when they run out (render.com/docs/free, checked 2026-10-09). The owner's workspace already spends about 744 h keeping `kbg-backend` (burger site) awake, so a second always-on service would take the burger site down mid-month.
  - Render free also has no shell, no one-off jobs, no pre-deploy hook, and a one-minute wake from sleep.
  - The repo is public. The team is two people, so operations must stay minimal.
  - Full sources: `specs/007-launch-ready/research.md` R1–R13.

## Decision

One cluster: where each tier runs, and how code and schema reach production safely.

- **Website**: Vercel Hobby project `shuaib-health-web` (root `frontend/`), function region **`sin1`**.
- **API**: a **second Vercel Hobby project `shuaib-health-api`** (root `backend/`) running FastAPI as **Python Functions** (Fluid compute, Python 3.12, uv), region **`sin1`**. The website keeps calling it server-to-server through the existing BFF, with `X-Proxy-Secret`.
- **Database**: Neon Free project `shuaib-health-prod` in `aws-ap-southeast-1`, compute **fixed at 0.25 CU**:
  - `main` branch = production;
  - `preview` branch = Vercel Preview (created empty, demo data only);
  - dev stays in its own separate project;
  - CI uses a disposable Postgres service container.
- **Migrations**: `alembic upgrade head` runs in the API project's **build step when `VERCEL_ENV` is `production` or `preview`** (each environment against its own database), using the direct URL with a bounded wait for Neon to wake. A failed migration fails the build, so the previous deployment keeps serving. Migrations stay additive and reversible, and a Neon restore point is taken before merging any PR that contains one.
- **One-off data**: the first seed and first admin run from the owner's laptop against the production direct URL. A target guard shows the masked host, requires typing the DB name, and refuses the dev URL.
- **Rollback**: Vercel Instant Rollback per project (website and API independently). For the database: the migration's downgrade, or the Neon restore point / 6 h instant restore.
- **Monitoring**:
  - UptimeRobot Free: website `/` and API `/health` every 5 min; API `/ready` and one catalog page **hourly**, so Neon isn't kept awake.
  - Sentry Free (DSN-gated, scrubbed) on both tiers.
  - Vercel deploy-failure notifications.
- **Backups**: a daily `pg_dump` (read-only role), **age-encrypted** to the owner's public key, stored as an artifact in a **private** repo `shuaib-health-backups` with `retention-days: 14`. A manual monthly copy goes to the owner's Google Drive. A restore drill must pass before launch.
- **Delivery**: GitHub Actions CI (backend, frontend, secrets, e2e jobs), all required by branch protection on `main`. There are 0 required approvals and no admin bypass; the owner's merge click is the approval.
- **Untouched**: the owner's Render workspace and `kbg-backend` are not changed in any way.

### Approval conditions (binding, detail in plan.md "Owner conditions")
- **C1**: Neon **pooled** URL with a serverless-safe pool (`pool_size=1`, `max_overflow=1`, 5 s pool timeout, pre-ping). Production refuses a non-pooler runtime URL.
- **C2**: all rate limits and lockouts use **shared Postgres state**. The last in-memory limiter (the global per-IP middleware) is replaced by a Postgres limiter behind the existing `RateLimiter` protocol. Vercel KV and Edge Config were rejected.
  - **Failure mode (owner decision, 2026-10-09):** if Postgres is unreachable, **only** the general per-IP check lets requests through, logged by error class. Booking, login, lookup and demo-start limits keep blocking.
  - The new limiter sits behind `RATE_LIMIT_STORE` (OFF = `memory` in code, `postgres` in production).
- **C3**: **no background threads or long-running tasks** in functions:
  - the startup background purge is removed and replaced by a daily **Vercel Cron** calling a `CRON_SECRET`-protected synchronous purge endpoint;
  - Sentry flushes before the response returns.
- **C4**: Python cold start is measured on a **preview** deploy and recorded against the speed promise before production.
- **Money rule**: billing is never enabled. If a free allowance runs out, the demo pauses until month end.
- **Flags (Constitution XI)**: `RATE_LIMIT_STORE`, `TRUSTED_SERVER_EXEMPT`, `MAINTENANCE_VIA_CRON` and `SITE_SECURITY_HEADERS` are OFF in code and required explicitly in production. Endpoints with secrets stay off without their secret.
- **Previews**: a demo-only Neon branch, created empty and migrated by preview builds; protection bypass for preview server-to-server calls.

## Consequences

### Positive

- **$0 with no card anywhere**: no surprise-bill path. On Hobby, going over the allowance pauses the projects rather than billing.
- **Burger site safe**: the Render hours and the `kbg-backend` monitor are unchanged.
- **Fast**: website function, API function and database are all in Singapore. No 15-minute sleep and no one-minute wake; a cold start is a second or two (to be measured), so no keep-alive is needed.
- **Safer schema rollout** than Render free: a migration failure happens *before* go-live, in the build.
- **One platform for both tiers**: one dashboard, one rollback model, one place for env vars and deploy notifications.
- **Previews are isolated**: they never touch production data or secrets.
- **Backups**: private, encrypted, auto-expiring, and need no long-lived Google credentials.

### Negative

- **Shared Hobby allowance**: both projects draw from one allowance (4 h Active CPU, 1M invocations, 360 GB-h memory). If it runs out, **both are paused until month end**. Mitigation: weekly usage check with a ≤ 80% projection target.
- **Rate limiting moves to Postgres**: Fluid compute can run several instances, so per C2 the global limiter moves to Postgres too. This adds one small counter write to each rate-limited public API request (a few ms in-region). `/health` and trusted ISR/build traffic stay exempt, so Neon isn't woken just to count.
- **Short logs**: runtime logs last only 1 hour on Hobby, so Sentry becomes essential.
- **More Vercel lock-in**: lowered because FastAPI stays a plain ASGI app (returning to Render or any container host needs only a start command).
- **Python Functions limits**: a 60 s max duration, a 500 ms shutdown window, and no long-running background workers. The current app needs none of these; startup purge and per-booking purge already exist.
- **Non-commercial only**: the demo must stay non-commercial (no prices, sales pitch or "hire us"). The first paying client means Vercel Pro (website **and** API) plus a Neon plan without forced scale-to-zero.
- **Constitution amendment**: the Tech Stack section and Phase 4 wording say Render, so the constitution needs a MINOR amendment.

## Alternatives Considered

- **A. Render, same workspace as `kbg-backend`.** Rejected: 744 + the clinic's hours exceed 750, which suspends **all** free services including the burger site. Even letting the clinic sleep breaks the speed promise (about a one-minute wake).
- **B. Render, a second workspace or account for the clinic.** It fits on paper (744 ≤ 750). Rejected: the Terms license use "for your own use only" and allow suspension "for any reason". A second workspace to get more free hours reads as getting around the limit, and enforcement could hit the owner's whole login, burger site included.
- **C. Vercel Services (one project, Next.js + FastAPI, private internal binding).** The most elegant option, because the API wouldn't be public. Deferred: it is beta, it restructures the existing website project's config, and it couples website and API deploys and rollbacks. Revisit after launch.
- **D. Koyeb free instance.** Rejected: the free instance is Frankfurt or Washington only (not Singapore), a card with a $29 pre-authorisation is needed, it scales to zero after 1 h, and ownership changed in 2026.
- **E. Google Cloud Run (asia-southeast1).** Rejected: needs a billing account with a card and has no hard spending cap. Singapore is a Tier 2 region (the free allowance runs out faster), and keeping it warm (`min-instances=1`) is billed.
- **F. Oracle Cloud Always Free VM (Singapore home region).** Always on with no cold start. Rejected: card verification, idle reclamation when the 7-day p95 CPU, network and memory are all below 20% (a quiet demo would trigger it), and full ops burden (OS patching, TLS, reverse proxy, process supervision).
- **Backups: automated Google Drive upload.** Rejected for now: a personal Drive needs a long-lived owner OAuth refresh token in CI (service accounts have no My Drive quota), and Testing-mode tokens expire after 7 days. A manual monthly Drive copy keeps the owner's preference without the risk.
- **Migrations: at app startup, or manual from a laptop.** Rejected: startup runs on every cold start, can race across instances, and fails after go-live. Manual is easy to forget.

## References

- Feature Spec: specs/007-launch-ready/spec.md (FR-001–016, 050–059, 074–075)
- Implementation Plan: specs/007-launch-ready/plan.md
- Research: specs/007-launch-ready/research.md (R1 hosting comparison with sources; R3 migrations; R7 monitoring budget; R9 backups)
- Contracts: specs/007-launch-ready/contracts/required-settings.md, ci-checks.md, ops-endpoints.md
- Related ADRs: ADR-0003 (in-memory limiter, assumed a single instance: **amended in effect**, see Negative), ADR-0006 (proxy trust and Postgres limits, unchanged and relied on), ADR-0008 (BFF, unchanged)
- Evaluator Evidence: history/prompts/007-launch-ready/002-launch-ready-plan-and-hosting-adr.plan.prompt.md
