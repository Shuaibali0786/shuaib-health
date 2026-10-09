# Research: 007 Launch Ready

**Date checked**: 2026-10-09 · Sources are official vendor docs fetched today unless marked *(secondary)*.
Nothing was signed up for, configured or deployed.

---

## R1. Where should the clinic API run? (FR-074)

### The constraint
The owner's Render account already keeps `kbg-backend` (burger site) awake 24/7 with UptimeRobot, using about 744 of the free hours each month. The clinic API must be fast, cost $0, and must not affect the burger site.

### (a) Render: are the 750 hours per workspace or per service? Is a second workspace allowed?

| Question | Finding | Source |
|---|---|---|
| Scope of 750 h | **Per workspace**, per calendar month: "750 Free instance hours to each workspace per calendar month". Spun-down services use no hours; unused hours don't roll over. | render.com/docs/free |
| When exhausted | Render "**suspends all of your Free web services** until the start of the next month". | render.com/docs/free |
| Sleep / cold start | Sleeps after 15 min with no inbound traffic; spin-up takes "about one minute" (the browser sees a loading page). | render.com/docs/free |
| Free-service limits | No shell, no one-off jobs, one instance only, may be restarted at any time. Pre-deploy isn't mentioned (the audit says it is paid-only). | render.com/docs/free |
| Second workspace | No clause found that explicitly allows or forbids it. The Terms grant use "for your own use only" and let Render "suspend or terminate your access … for any reason". Opening a second workspace (or account) just to get another 750 h reads as getting around the limit. | render.com/terms and render.com/acceptable-use via search excerpts *(the full Terms text couldn't be fetched)* |

**Consequences for us:**
- **Same workspace, clinic kept awake**: 744 + ~744 h is more than 750, so around mid-month Render suspends **every** free service, **including the burger site**. ❌ Breaks FR-074.
- **Same workspace, clinic allowed to sleep**: it still uses hours whenever it's awake, so any real traffic pushes the total past 750 and suspends both services. Visitors also wait about a minute on every cold start, which breaks the speed promise. ❌
- **Second workspace**: it would fit on paper (744 ≤ 750), but whether the Terms allow it is uncertain, and a suspension could hit the owner's whole login, burger site included. ❌ Rejected on risk.

### (b) FastAPI as Python functions on Vercel, region `sin1`

| Topic | Finding | Source |
|---|---|---|
| Support | Supported out of the box: Vercel finds the FastAPI `app` instance; runs ASGI; Python **3.12 (default)**, 3.13, 3.14; **uv** supported for builds; bytecode is precompiled to speed up starts. | vercel.com/docs/functions/runtimes/python, /docs/frameworks/backend/fastapi |
| Lifespan | FastAPI lifespan events are supported; shutdown cleanup is limited to 500 ms. | /docs/frameworks/backend/fastapi |
| Build step | `[tool.vercel.scripts] build` in `pyproject.toml`, or a Build Command, runs after dependencies install and before the app is deployed. | /docs/frameworks/backend/fastapi |
| Region | Default is `iad1`. **Hobby: one region**, which can be set to `sin1` in project settings or `vercel.json` `regions`. | /docs/functions/configuring-functions/region |
| Max duration | Hobby: 10 s default, 60 s maximum. | /docs/limits |
| Hobby allowance (shared by every project on the account) | 1,000,000 function invocations · **4 h Active CPU** · 360 GB-hours provisioned memory · 100 GB Fast Data Transfer · 10 GB Fast Origin Transfer per month. | /docs/limits/fair-use-guidelines |
| Commercial use | Hobby is "non-commercial personal use only"; "Advertising the sale of a product or service" counts as commercial. | /docs/limits/fair-use-guidelines |
| Logs | Runtime logs are kept for **1 hour** on Hobby. | /docs/limits |
| Git | A Hobby account can't connect to repos owned by a GitHub *organisation*. Ours is user-owned (`Shuaibali0786/shuaib-health`). ✅ | /docs/limits |
| One project with two services | "Services (Beta)" lets a Next.js app and a FastAPI app share one project, with a **private internal binding** (the backend isn't public unless a rewrite exposes it). Available on all plans, but still beta. Each service is billed like a Function; internal calls count as Service Requests (Hobby: first 1M). | /docs/services, /docs/services/pricing |

**Cold starts:** Fluid compute reuses warm instances, so there is no 15-minute sleep and no one-minute wake. A cold Python start (import FastAPI + SQLModel + psycopg) is typically a second or two, plus about 0.5–1 s for Neon to wake if it is suspended. This must be **measured** (FR-070); it isn't documented as a number.

**What changes in our code if we pick Vercel:**
- The in-memory catalog limiter (60/min per IP, ADR-0003) becomes per instance, and Fluid can run more than one instance, so the effective limit becomes "60 × instances". Booking, lookup and login limits are **already in Postgres** (ADR-0006), so they stay exact. Acceptable for read-only public catalog data; recorded as a risk.
- The startup purge (`main.py` lifespan → `_startup_purge`) runs on every cold start. It is bounded and already exists; the purge after each booking also runs. No scheduler is needed.
- `TRUSTED_PROXY_HOPS` is measured on Vercel instead of Render (FR-031).
- Start-command concerns (`--port $PORT`, `--no-access-log`, FR-004/N4) don't apply: Vercel runs the ASGI app directly.

### (c) Other genuinely free always-on options near Singapore

| Option | Free allowance | Singapore? | Card? | Sleep / cold start | Verdict |
|---|---|---|---|---|---|
| **Koyeb** | One free web service: 512 MB, 0.1 vCPU | **No.** The free instance runs in Frankfurt or Washington D.C. only *(secondary; the official pricing page lists no free web instance)* | **Yes**: $29 pre-authorisation, new accounts default to Pro *(secondary)* | Scales to zero after 1 h idle | ❌ Wrong region, card needed, and it changed owner (Mistral, Feb 2026) |
| **Google Cloud Run** | 2M requests, 180k vCPU-s, 360k GiB-s per month (request-based billing) | Yes (`asia-southeast1`), but it is a **Tier 2** price region, so the free allowance runs out faster *(official locations page via search)* | **Billing account needed** for the free tier; the free trial needs a card. No hard spending cap, only budget alerts | Scales to zero: a Python cold start of a few seconds. `min-instances=1` removes it but **is billed**, so it isn't free | ❌ Card plus open-ended billing breaks the founder money rule; still has cold starts at $0 |
| **Oracle Cloud Always Free** | Ampere A1, 2 OCPU / 12 GB total, or 2 × AMD micro | Yes, if Singapore is chosen as the **home region** at signup (it can't be changed later) | Card needed for verification *(not stated on the page checked)* | Always on, no cold start. **But** idle instances are **reclaimed** if the 7-day p95 CPU, network and memory are all below 20%, which a quiet demo would be | ❌ Reclamation risk, plus we would own OS patching, TLS, reverse proxy and process manager. Too much ops for a two-person team |
| GCE e2-micro always-free | 1 VM | **No.** US regions only | Billing account | Always on | ❌ Wrong region |

### Decision
**Run the FastAPI backend on Vercel Python Functions as a second Vercel project (`shuaib-health-api`) in `sin1`, on the same Hobby account as the website.** Render isn't used for the clinic, so `kbg-backend` and its UptimeRobot keep-alive are untouched.

### Rationale
- **$0, no card**: covered by the same Hobby account.
- **Burger site untouched**: no change to the Render workspace (FR-074).
- **Speed**: the website function, API function and Neon all sit in Singapore. No 15-minute sleep and no one-minute wake; worst case is a second or two of cold start, and nothing is kept awake.
- **Safer migrations than Render free**: they run in the *build* step of production deploys, so a failed migration fails the build and the previous deployment stays live (R3).
- **One dashboard and one rollback model** (Instant Rollback) for both tiers.

### Why a separate project rather than Vercel Services (one project)
Services would keep the API private (internal binding), which is attractive. But it is **beta**, it changes how the existing Next.js project is configured (build fields move into per-service config), and it couples the two deploys so they can't be rolled back separately. Revisit after launch; recorded as a follow-up in the ADR.

### Tradeoffs we accept (all recorded in the ADR)
1. Both projects share **4 h Active CPU and 1M invocations a month**. If exceeded, Hobby **pauses** the projects until the next month: no bill, but the demo goes down. Mitigation: a weekly usage check (FR-073); the projection must stay ≤ 80% (SC-010).
2. The in-memory catalog limiter is per instance (see above).
3. Runtime logs only last 1 hour, so error tracking (R6) is essential, not optional.
4. More lock-in to Vercel. FastAPI stays a plain ASGI app, so moving back to Render, or any container host, needs only a start command.
5. **Constitution amendment needed**: the Technology Stack section says "Backend … Hosted on Render" and Phase 4 says "Deploy (Vercel + Render)". This decision needs `/sp.constitution` (MINOR bump) **owner approval** before implementation.

---

## R2. Region alignment (FR-002, I1)
- **Decision**: Website project `regions: ["sin1"]`; API project `regions: ["sin1"]`; Neon project in `aws-ap-southeast-1` (Singapore).
- **Rationale**: all three are in Singapore, so server-to-server round trips stay within one region.
- **Verify on first deploy**: deployment summary shows `sin1`; Neon console shows `aws-ap-southeast-1`.

## R3. Migrations on deploy (FR-010–012, B2)
- **Decision**: The API project's build runs `alembic upgrade head` (using that environment's `DIRECT_DATABASE_URL`) when `VERCEL_ENV` is `production` **or** `preview`. Preview migrates its own demo-only Neon branch (R8), so preview `/ready` and the C4 measurement work. Local and CI builds never migrate from the build step.
- **Why build-time**: Vercel has no start command for Python functions and no pre-deploy hook; the build is the last step before the new deployment goes live. A failing migration fails the build, so the old deployment keeps serving.
- **Safety rails**: migrations stay additive and reversible (playbook rule 8), so the old code works with the new schema, and Instant Rollback stays safe. Before merging a PR that contains a migration, a Neon restore point (snapshot or branch) is taken (FR-057; checklist item). `/ready` reports not-ready until the schema is at head (already implemented).
- **Neon asleep at build time**: the connection is retried with a bounded wait (about 30 s) before the build fails.
- **Alternatives rejected**: migrating at app startup (it would run on every cold start, multiple instances could race, and a failure would happen after go-live); running it manually from a laptop (easy to forget).

## R4. One-off seed and first admin (FR-013–015)
- **Decision**: Keep the existing CLIs (`python -m app.seed…`, `python -m app.auth.create_admin`), run once from the owner's laptop against the **production direct URL**, set only in a throwaway shell. Add a target guard to both:
  - print the masked host and database name;
  - require typing the database name to confirm;
  - refuse if the URL equals `DEV_DATABASE_URL` from the local `.env`, or if the host isn't on the production allow-list given by the flag.
- **Seed in production**: the existing refusal stays the default. A deliberate `--i-understand-this-is-production` flag combined with the guard is the only production path.
- **Admin password**: entered interactively (already the case); add a success line that prints no secret.

## R5. Real client IP and rate limiting (FR-030–034, B3, N1)
- **Decision**:
  1. The website's catalog fetches send `X-Proxy-Secret` and, when there is a visitor, `X-Client-IP`.
  2. The backend middleware skips the per-IP global bucket for requests with a valid secret that carry no `X-Client-IP` (builds and ISR regeneration). With `X-Client-IP`, it keys the bucket on the visitor.
  3. `clientIpFrom()` prefers `x-vercel-forwarded-for`, then `x-real-ip`, then the first `x-forwarded-for` (N1).
  4. `TRUSTED_PROXY_HOPS` is set from one measured request on the live API and recorded in the runbook.
- **Tests**: 61st website-origin catalog request → not 429; forged XFF without secret → not trusted; two visitors → independent buckets.

## R6. Error tracking (FR-052)
- **Decision**: **Sentry free Developer plan**, with one project each for the website (`@sentry/nextjs`) and the API (`sentry-sdk[fastapi]`). Only when a DSN is set (absent locally and in CI). `send_default_pii=False`, plus a `before_send` scrubber that drops cookies, auth and proxy headers, query strings and request bodies, and masks phone/email/reference patterns. Sample rates are low.
- **Alternatives**: Better Stack (logs-first), GlitchTip (self-host, which is ops). Sentry has first-party SDKs for both stacks and a free tier with one seat. *(The exact free event quota should be confirmed on the Sentry pricing page during implementation.)*
- **Constitution**: two new runtime dependencies, justified in Complexity Tracking.

## R7. Monitoring and keep-alive (FR-050–054, I3, I5)
- **Decision (UptimeRobot free)**:

| Monitor | Interval | Why |
|---|---|---|
| Website `/` | 5 min | Is the website up? |
| API `/health` | 5 min | Is the API up? It doesn't touch the DB, so Neon stays asleep. |
| API `/ready` | **60 min** | Checks DB and migration head; wakes Neon at most hourly. |
| One catalog page | **60 min** | Full website→API→DB path; ISR may trigger regeneration. Hourly keeps Neon cost bounded. |

- **Neon compute budget**: free plan is 100 CU-hours per project per month, and compute suspends after 5 minutes (fixed). With compute pinned at **0.25 CU** (no autoscale to 2 CU), 100 CU-h is about 400 awake hours. Hourly checks cost about 24 × 30 × ~6 min ≈ 72 h ≈ 18 CU-h. Demo visitors and the daily backup add a little. Projection is about 30–40% of the allowance.
- **Keep-alive**: with Vercel there's no sleep to fight, so no keep-alive service is needed. The 5-minute `/health` check also keeps one function instance warm more often.
- **Alerts**: UptimeRobot mobile-app push and email (free). Vercel deploy-failure notifications are on for both projects.

## R8. Environments and databases (FR-005, FR-016, Constitution VII)
- **Neon production project** (Singapore): `main` branch = production. A **`preview` branch** is created **while the project is still empty** (before any migration or seed), so it never holds production data (playbook §2). It is migrated by preview builds and seeded with demo data only. No production credentials go to previews. Taking a restore point (snapshot or branch) before migrations uses this project's 10-branch allowance.
- **Dev database**: stays in its existing separate Neon project, so dev work doesn't use production compute hours.
- **CI test database**: a Postgres **service container** inside GitHub Actions (disposable, $0, never Neon). This satisfies "tests never touch dev or prod".

## R9. Backups (FR-055–059, I4) — Google Drive vs the simplest safe alternative
- **Automated upload to the owner's Google Drive was examined:**
  - Service accounts can't store files in a personal "My Drive" (they have no storage quota). Shared drives need Google Workspace, which is paid.
  - So CI would need a **long-lived OAuth refresh token for the owner's personal Google account** stored as a GitHub secret.
  - While the OAuth app stays in "Testing", Google expires refresh tokens after 7 days, so the job would quietly break weekly. Publishing the app means going through Google's consent-screen review.
  - Even with the narrow `drive.file` scope, a leaked token touches the owner's personal account.
  - *(Google OAuth behaviour from general knowledge; confirm during implementation if this path is chosen.)*
  - **Too much risk and complexity for the free phase.**
- **Decision (simplest safe alternative):** a **separate private GitHub repository** `shuaib-health-backups` with one scheduled workflow (daily, ~02:00 Asia/Karachi):
  1. `pg_dump` from the Neon **direct** URL using a **read-only** Neon role.
  2. Encrypt with **`age`** to the owner's **public** key; the private key lives only on the owner's laptop and in their password manager.
  3. Upload as a workflow artifact with **`retention-days: 14`**; GitHub deletes older copies automatically.
  4. GitHub's failed-workflow email alerts the owner.
- **Why it meets the spec**:
  - Off the database host; encrypted before it leaves the runner.
  - Not public (private repo).
  - Kept exactly 14 days; key not stored with the backups.
  - $0: a private repo gets 2,000 free CI minutes a month and this job uses about 2–3 minutes a day.
  - No Google token anywhere.
- **Google Drive stays possible**: once a month (or after each restore drill) the owner downloads the latest artifact and drops it into Drive by hand, a 1-minute step in the runbook. Automating it can come later.
- **Also**: Neon's 6-hour instant restore and 1 manual snapshot cover "undo the last few hours".
- **Restore drill**: download artifact → decrypt with `age` → `pg_restore` into a new Neon branch → compare row counts and one known booking reference → record duration (target < 30 min).

## R10. CI (FR-040–045, B1)
- **Decision**: `.github/workflows/ci.yml` on `pull_request` to `main`, with parallel jobs:
  - `backend`: uv, ruff, mypy, pytest against a Postgres 16 service container, alembic up/down/up, pip-audit.
  - `frontend`: npm ci, eslint, tsc, Vitest, `next build`, `next build` with `CATALOG_API_URL` pointed at a dead host, npm audit at high level with the allow-list.
  - `secrets`: gitleaks on the PR diff.
  - `e2e`: Playwright, a separate required job, timeout 20 minutes.
- **Running e2e in CI**: e2e starts the backend (uv) and frontend in the job against the service-container DB. The repository is **public**, so standard runner minutes are free. e2e is **always required** (Constitution IX). Flaky specs are fixed; quarantine needs the owner's written approval (FR-041).
- **Branch protection on `main`**: all 4 jobs required, up-to-date branches, no force-push or deletion, admins included (no bypass), **0 required approvals**. The owner authors PRs from their own account and GitHub forbids self-approval, so the owner's merge click is the approval (FR-042).
- **Full-history gitleaks**: run once locally before launch (FR-064).

## R11. npm audit highs (FR-061)
- **Findings today**: 6 highs. Five are the chain `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`; the sixth is `source-map-js`.
- **Decision**:
  1. `npm audit fix` without `--force` for `source-map-js`.
  2. Add an `overrides` entry pinning `braces` (and, if needed, `micromatch`) to a patched version, then rerun lint and the full test suite.
  3. If no patched `braces` exists (the advisory range shows `*`), record the chain in `audit-allowlist.json`: dev-only lint tooling, never shipped to the browser or server, with a review date and owner approval.
- **Never**: `npm audit fix --force` (it downgrades `eslint-config-next` to 14.x; playbook §6).

## R12. Security headers (FR-065)
- **Decision**: add site-wide headers in `next.config.ts`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (no `preload` until there's a custom domain);
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'`;
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **CSP rollout**: start with a CSP in **Report-Only** mode on public pages for one release, then enforce. The existing stricter `PRIVATE_HEADERS` on admin routes stay.
- **Verify**: smoke checklist and a Playwright header assertion.

## R13. Performance measurement (FR-067–070)
- **Lighthouse**: run in mobile mode against the live home page and one catalog page, 3 runs each, median, warmed first. Store JSON and HTML in `specs/007-launch-ready/results/`.
- **API p95**: a small script runs 200 sequential requests against catalog endpoints and 20 against slot lookup, from a Vercel function in `sin1` (or from the owner's laptop, noting the network), and reports p50/p95.
- **Cold start**: measured once after 30 minutes idle (Neon suspended) and recorded.
