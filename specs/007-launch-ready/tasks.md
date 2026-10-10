---
description: "Task list for 007-launch-ready"
---

# Tasks: Launch Ready — First Live, Monitored, Safe Public Demo

**Input**: `specs/007-launch-ready/` — plan.md (incl. owner conditions C1–C4), spec.md, research.md, data-model.md, contracts/, quickstart.md
**Prerequisites**: ADR-0011 Accepted ✅ · Constitution 1.2.0 ✅
**Tests**: required by Constitution IX for new logic. No existing test may be deleted or loosened (Constitution XI).

**Task IDs are stable references.** Tasks added after the analysis (T105–T116) sit where they execute, so IDs are not in numeric order; follow the list order.

## Format: `- [ ] T### [P?] [US#?] Description (path)`

- **[P]**: can run in parallel (different files, no unfinished dependency)
- **[US#]**: user story from spec.md
- **🔑 OWNER ACTION**: only the owner can do this (create accounts, enter secrets in dashboards, approve merges, handle real devices). Claude prepares, guides and verifies, and **never sees secret values**.

## Delivery slices (pull requests)

| PR | Contains | Merge gate |
|---|---|---|
| **PR-1** `007-launch-ready` → main | Phase 1–3 (setup, foundations C1–C3, CI) | CI green + 🔑 owner approval |
| **PR-2** | Phase 4–5 code (rate limiting, live-demo hardening) + Phase 6 code (Sentry) | CI green + 🔑 owner approval |
| **PR-3** | Runbooks and docs (Phase 7–9 docs) | CI green + 🔑 owner approval |
| — | Owner-run launch and verification (dashboards, phone, drills) | Evidence saved in `specs/007-launch-ready/results/` |

---

## Phase 1: Setup

**Purpose**: baseline evidence and folders; nothing changes behaviour.

- [X] T001 Run each existing suite once, sequentially and in clean runs (backend pytest, frontend Vitest, the three Playwright configs), and record pass counts as the "before" baseline in specs/007-launch-ready/results/baseline.md
- [X] T002 [P] Create specs/007-launch-ready/results/README.md listing every evidence file this feature must produce (baseline, gitleaks-history, cold-start, smoke, phone-qa, lighthouse, p95, alert-test, sentry-check, restore-drill, rollback-rehearsal, usage-day7, final-suites)
- [X] T003 [P] Create docs/runbooks/README.md as an index of the runbooks added in Phase 7–9 (links can be placeholders until written)
- [X] T004 [P] Run gitleaks over the full git history with redaction (FR-064) and record the result (no secret values) in specs/007-launch-ready/results/gitleaks-history.md. If anything is found, stop and report to the owner, who must rotate the secret.

---

## Phase 2: Foundational (blocking: serverless safety and fail-closed production)

**Purpose**: owner conditions C1–C3, and production settings that fail when missing. Every user story depends on this phase.

### Feature flags (Constitution XI, FR-079)
- [X] T105 Add flags to backend/app/settings.py, all **OFF in code**: `rate_limit_store: Literal["memory","postgres"] = "memory"`, `trusted_server_exempt: bool = False`, `maintenance_via_cron: bool = False`. When `APP_ENV=production`, each must be set explicitly (startup error naming the missing flag), and `maintenance_via_cron=false` is rejected in production (C3).
- [X] T106 [P] Add tests for defaults (OFF), the production explicit-value requirement, and the production rejection of `maintenance_via_cron=false`, in backend/tests/unit/test_feature_flags.py

### C1: serverless-safe pooled database connection
- [X] T005 Add settings `db_pool_size` (default 1, 1–10), `db_max_overflow` (default 1, 0–10), `db_pool_timeout` (default 5 s, 1–30) in backend/app/settings.py
- [X] T006 Use those settings in `make_engine` / `get_engine`, keeping `pool_pre_ping`, `pool_recycle=300`, `connect_timeout=10`, `prepare_threshold=None`, in backend/app/db.py
- [X] T007 [P] Add tests for pool defaults and bounds, and confirm the existing pooled/direct URL validation (settings.py L117–121) also rejects a non-pooler `DATABASE_URL` when `APP_ENV=production`, in backend/tests/unit/test_db_pool_settings.py

### C3: no background threads or long-running tasks
- [X] T008 Add the `cron_secret: SecretStr | None` setting (≥ 32 chars; **required when `APP_ENV=production`**) in backend/app/settings.py
- [X] T009 Create backend/app/routers/maintenance.py implementing `GET|POST /internal/maintenance/purge` per contracts/ops-endpoints.md:
  - Bearer `CRON_SECRET` compared in constant time; 404 otherwise;
  - `include_in_schema=False`;
  - synchronous bounded purge with a < 20 s budget;
  - exempt from the per-IP limiter only when authorised;
  - mounted **only when `maintenance_via_cron=true` and `CRON_SECRET` is set**.
- [X] T010 In backend/app/main.py, when `maintenance_via_cron=true`: start **no** task or thread in `lifespan` and register the maintenance router. When false (code default, local and tests): keep today's startup purge unchanged. Move the shared purge logic to backend/app/booking/maintenance.py so both paths call the same function.
- [X] T011 (owner-approved 2026-10-09) Run backend/tests/api/test_retention.py unchanged with the flag default (startup purge). Then add the **same assertions** for the cron path (`maintenance_via_cron=true`) as new parametrised cases. Every original assertion is kept and none is loosened; the PR description lists exactly what was added or moved.
- [X] T012 [P] Add tests in backend/tests/api/test_maintenance_purge.py:
  - with the flag ON: no or wrong bearer → 404; correct → 200 with `purged`; second call → `purged: 0`; route absent from OpenAPI; lifespan schedules no task or thread;
  - with the flag OFF or `CRON_SECRET` unset: route → 404.

### C2: shared-state rate limiting (no in-process memory)
- [X] T013 Add `PostgresFixedWindowLimiter` implementing the existing `RateLimiter` protocol in backend/app/middleware/rate_limit.py:
  - reuse the atomic upsert of `rate_limit_counter` from backend/app/booking/limits.py;
  - bucket key = HMAC(`PRIVACY_HASH_KEY`, ip);
  - 60 s window;
  - on a DB error, allow the request and log the error class. This fail-open applies to **this general per-IP check only** (owner decision; ADR-0011 C2). Booking, login, lookup and demo-start limits keep blocking, unchanged.
- [X] T014 Wire `PostgresFixedWindowLimiter` when `rate_limit_store="postgres"`, and `InMemoryFixedWindowLimiter` otherwise (code default), in backend/app/main.py. Both classes and all existing tests stay.
- [X] T015 [P] Add tests in backend/tests/api/test_rate_limit_shared.py:
  - two app instances sharing one database share the count (61st request across both → 429);
  - `/health` never writes a counter;
  - a DB failure lets the general check through but booking, login and demo limits still refuse.
  Add counter-table cleanup to the shared test fixture in backend/tests/conftest.py (add-only; no assertion changed).
- [X] T107 **Existing-test guard (H6):** run backend/tests/api/test_rate_limit_api.py **unchanged**, once with the default (`memory`) and once with `RATE_LIMIT_STORE=postgres` set through the environment for the whole run (no edit to the file). If any assertion fails in either mode, **stop** and list the failing assertions and their cause for owner approval; never edit or loosen them to pass.
  - **Status (2026-10-10):** the owner approved an add-only fixture (`rate_limit_api_own_counters` in tests/api/conftest.py). `test_rate_limit_api.py` is unchanged and passes 7/7 in both modes; CI also runs it with `RATE_LIMIT_STORE=postgres`.

### Fail-closed production settings (B4, B5)
- [X] T016 Make `DEMO_MODE` and `DEMO_ENABLED` required (no default) when `APP_ENV=production`, with an error naming the setting, in backend/app/settings.py
- [X] T017 [P] Add tests for production with the demo switches or `CRON_SECRET` missing → startup error naming the setting and never its value; development keeps today's defaults. In backend/tests/unit/test_settings_production.py
- [X] T018 Require an explicit `DEMO_ENABLED` at build time when `VERCEL_ENV` is `production` or `preview`, in frontend/src/lib/demo.ts
- [X] T019 In frontend/src/lib/seo.ts, resolve the site URL in order: `SITE_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` (production) or `https://${VERCEL_URL}` (preview) → fail the build when `VERCEL_ENV=production` and none is set. Never emit an `http://` or `localhost` self-URL on Vercel.
- [X] T020 [P] Add unit tests for the demo-flag and site-URL resolution in frontend/tests/unit/demo-flag-production.test.ts and frontend/tests/unit/site-url.test.ts
- [X] T021 Set `openapi_url=None` when `APP_ENV=production` (N3) in backend/app/main.py, and add a **new** test in backend/tests/api/test_openapi_production.py

### Vercel project configuration (no accounts needed)
- [X] T022 Create backend/vercel.json with:
  - `regions: ["sin1"]`;
  - `functions` `maxDuration: 30`;
  - `excludeFiles` for tests and fixtures;
  - `crons: [{ path: "/internal/maintenance/purge", schedule: "0 21 * * *" }]`.
- [X] T023 Add `[tool.vercel] entrypoint` for the FastAPI app in backend/pyproject.toml. Vercel needs a top-level `app`, but backend/app/main.py exposes it lazily via `__getattr__`, so create backend/app/asgi.py with `app = create_app()` and point the entrypoint there; tests keep using the factory.
- [X] T024 Create backend/scripts/vercel_build.py and hook it via `[tool.vercel.scripts] build` in backend/pyproject.toml:
  - run `alembic upgrade head` with that environment's `DIRECT_DATABASE_URL` **only when `VERCEL_ENV` is `production` or `preview`** (never locally or in CI);
  - bounded retry (~30 s) while Neon wakes;
  - exit non-zero on failure;
  - print no URL.
- [X] T025 [P] Add tests in backend/tests/unit/test_vercel_build.py: runs for `production` and `preview`; skips when `VERCEL_ENV` is unset or `development`; retries then fails cleanly; output contains no URL.
- [X] T026 [P] Create frontend/vercel.json with `regions: ["sin1"]`
- [X] T027 Add a count-only `xffHops` field (number of `X-Forwarded-For` entries, never the addresses) to the structured access log, used to measure `TRUSTED_PROXY_HOPS` (FR-031), in backend/app/middleware/access_log.py. Add a test in backend/tests/unit/test_access_log_xff.py.
- [X] T028 Sync backend/.env.example and frontend/.env.example with contracts/required-settings.md (placeholders only, including `CRON_SECRET`, `DB_POOL_*`, `SENTRY_DSN`, the four flags and `API_PROTECTION_BYPASS`)

**Checkpoint**: full backend and frontend suites green in single sequential runs; no background task at startup; no in-memory limiter wired.

---

## Phase 3: User Story 2 — Every PR is checked before it can merge (P1)

**Goal**: CI on every PR, and merging needs green checks plus owner approval.
**Independent test**: a throwaway PR with a lint error and a fake secret fails `frontend` and `secrets`; once fixed, it is still blocked until the owner approves.

- [X] T029 [US2] Create the `backend` job in .github/workflows/ci.yml per contracts/ci-checks.md:
  - uv sync --frozen, ruff check, ruff format --check, mypy;
  - pytest against a Postgres 16 service container;
  - alembic up/down/up;
  - pip-audit.
- [X] T030 [US2] Add the `frontend` job to .github/workflows/ci.yml: npm ci, eslint, tsc --noEmit, vitest run, `next build`, then `next build` with `CATALOG_API_URL=http://127.0.0.1:9`, then the audit check
- [X] T031 [P] [US2] Add the `secrets` job (gitleaks on the PR range, redacted) to .github/workflows/ci.yml, plus the config .gitleaks.toml (allow-list only for known test fixtures, each with a comment)
- [X] T113 [P] [US2] Add the `.gitignore` check to the `secrets` job in .github/workflows/ci.yml (Constitution VI) per contracts/ci-checks.md: `git check-ignore` for the `.env` paths, and fail if `git ls-files` lists any `.env` file other than `*.env.example`. Prove it with a throwaway commit of a dummy `.env` in T037.
- [X] T114 [US2] Add Lighthouse CI to the `e2e` job (Constitution VIII):
  - add the `@lhci/cli` devDependency in frontend/package.json;
  - frontend/lighthouserc.json: mobile preset, 3 runs on `/` and one catalog page against `next start`; Accessibility and Best Practices ≥ 0.90 as **error**, Performance ≥ 0.90 as **warn**, SEO not asserted;
  - frontend/lighthouse-budget.json: script, style, image and total byte budgets set to today's measured build sizes + 10% (record the baseline in specs/007-launch-ready/results/lighthouse/ci-budget-baseline.md).
- [X] T115 [US2] **Linux visual baselines (playbook rule 5):** all 139 visual baselines under frontend/tests/**/*-snapshots/ (admin visual, confirmation slip and others) are `-win32` only, so the Linux CI `e2e` job has none to compare against. Generate the **Linux** baselines inside the official Playwright Docker image matching the installed `@playwright/test` version, **adding** `-linux.png` files and leaving every `-win32.png` untouched. Produce a cross-platform pixel-diff report (win32 vs linux, per snapshot, with the max diff) in specs/007-launch-ready/results/visual-linux-baselines.md.
- [ ] T116 [US2] 🔑 OWNER ACTION: review the visual-linux-baselines report and approve the new Linux baselines in the PR (rule 5: baselines change only with a pixel-diff report the owner has seen)
- [X] T032 [US2] Add the `e2e` job to .github/workflows/ci.yml as an **always-required** check (K1; Constitution IX): backend + `next start` against **its own** service container with demo seed (never shared with the `backend` job; playbook rule 3); the existing Playwright configs run **one after another**, never in parallel on the same database; 20 min timeout; traces uploaded only on failure. There is no optional fallback. If it is flaky, fix the spec; quarantine only with the owner's written approval in the PR.
  - **Status (2026-10-10):** implemented as one required check `e2e` (an aggregator over parallel parts, each under 20 min). The two offline assertions that failed before this feature now pass: the owner approved a strict, precise exception for the platform credit only (`data-testid=powered-by`). Nothing is quarantined.
- [X] T033 [US2] Fix the npm high findings without `--force` (FR-061):
  - run `npm audit fix`;
  - add an `overrides` entry for `braces`/`micromatch` in frontend/package.json if a patched version exists;
  - rerun eslint and all frontend suites.
- [X] T034 [US2] If any high finding remains, add frontend/audit-allowlist.json (advisory id, package, reason "dev-only lint tooling", review date) and frontend/scripts/check-audit.mjs that fails only on highs not listed. Flag the list for owner approval in the PR.
  - **Status (2026-10-10):** allow-list holds 3 advisories (braces; extract-zip x2), all dev-only with no patched release. Approved by the owner on 2026-10-10; each entry has a reason and a review date of 2026-11-09 (30 days).
- [X] T035 [P] [US2] Add a pip-audit allow-list file only if needed, at backend/audit-allowlist.txt, with reason and review date
  - **Status (2026-10-10):** not needed. pip-audit reports no known vulnerabilities, so no `backend/audit-allowlist.txt` was created.
- [X] T036 [P] [US2] Update .github/pull_request_template.md:
  - links to the runbooks;
  - "migration present → Neon restore point taken" item;
  - "no prices / sales pitch / hire-us (Vercel Hobby)" item;
  - "e2e is a required check; any quarantine needs owner approval";
  - "owner's merge click is the approval".
- [ ] T037 [US2] Open PR-1 as a draft, then open a throwaway PR containing a deliberate lint error and a fake secret-shaped string. Confirm the checks fail and the log shows path and line without the value. Also confirm (after T038) that merge is blocked for the admin account while a check is red. Record in specs/007-launch-ready/results/ci-proof.md, then close the throwaway PR.
  - **Status (2026-10-10):** throwaway PR proof done (results/ci-proof.md). Still to confirm after T038: the Merge button is blocked for the admin account while a check is red.
- [ ] T038 [US2] 🔑 OWNER ACTION: enable branch protection on `main` (GitHub → Settings → Branches) exactly per contracts/ci-checks.md:
  - required checks `backend`, `frontend`, `secrets`, `e2e`;
  - branches up to date;
  - **0 required approvals** (your merge click is the approval);
  - **include administrators** (no bypass);
  - no force-push or deletion.
- [ ] T039 [US2] 🔑 OWNER ACTION: review and approve the merge of **PR-1**

**Checkpoint**: `main` is protected, and CI blocks every unsafe merge from here on.

---

## Phase 4: User Story 4 — Fair rate limiting behind the proxies (P1)

**Goal**: website server traffic never shares one bucket; visitors are limited individually; forged headers are not trusted.
**Independent test**: 100 trusted catalog requests in a minute → zero 429s; one external client over the limit → 429; two visitors independent.

- [ ] T040 [US4] In backend/app/middleware/rate_limit.py, behind `trusted_server_exempt` (OFF in code):
  - a valid `X-Proxy-Secret` (constant-time) with **no** `X-Client-IP` → exempt from the per-IP bucket (builds, ISR);
  - valid secret **with** `X-Client-IP` → key on that visitor IP;
  - otherwise → today's rules with `TRUSTED_PROXY_HOPS`.
- [ ] T041 [US4] Send `X-Proxy-Secret` (server-only env) on every catalog fetch, plus `X-Client-IP` when a request context exists, in frontend/src/lib/api/http.ts. The secret must never reach a client bundle; add or confirm the `server-only` import.
- [ ] T042 [P] [US4] Make `clientIpFrom()` prefer `x-vercel-forwarded-for`, then `x-real-ip`, then the first `x-forwarded-for` entry (N1), in frontend/src/lib/booking/backend.ts
- [ ] T043 [P] [US4] Add backend tests in backend/tests/api/test_rate_limit_trust.py:
  - 61st trusted catalog request → not 429;
  - 100 in a minute → zero 429s;
  - forged XFF without secret → not trusted;
  - two visitors via `X-Client-IP` → independent.
- [ ] T044 [P] [US4] Add frontend tests for header preference order and for "secret header is added server-side only" in frontend/tests/unit/client-ip.test.ts and frontend/tests/unit/catalog-http-secret.test.ts

- [ ] T108 [US4] **Existing-test guard (H6):** after T040–T042, rerun backend/tests/api/test_rate_limit_api.py **unchanged**: flag OFF, then `TRUSTED_SERVER_EXEMPT=true` with `RATE_LIMIT_STORE=postgres` via the environment. Any failing assertion → **stop** and list it for owner approval; never edit or loosen it.

**Checkpoint**: SC-012 passes locally; T107 and T108 are green.

---

## Phase 5: User Story 1 — A visitor opens the live demo and everything works (P1) 🎯 MVP

**Goal**: a fast, honest, noindex live demo with no localhost anywhere.
**Independent test**: the live smoke checklist passes on desktop and on a real phone on mobile data; Lighthouse mobile ≥ 90; API p95 < 1 s.

### Code and docs (Claude)
- [ ] T045 [US1] Add site-wide security headers behind `SITE_SECURITY_HEADERS` (`off` in code; `report` / `enforce`), in frontend/next.config.ts:
  - HSTS without preload, nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy;
  - CSP as Report-Only for `report`, enforced for `enforce`;
  - the existing `PRIVATE_HEADERS` on admin routes stay unchanged in every mode;
  - a production build with the flag unset fails, naming it.
- [ ] T046 [P] [US1] Add Playwright specs frontend/tests/e2e/security-headers.spec.ts (headers present on `/`, a catalog page and `/admin/login`) and frontend/tests/e2e/no-localhost.spec.ts (canonical, og:url, sitemap.xml and robots.txt contain no `localhost`/`http://` self-links; robots disallows all while `indexable=false`)
- [ ] T047 [P] [US1] Search the site copy (frontend/src/data/, frontend/src/lib/content.ts, page components) for prices, sales pitch or "hire us" calls to action (FR-075). Report each hit with its path in the PR for the owner; remove nothing without approval.
- [ ] T048 [US1] Create a shared target guard in backend/app/ops/target_guard.py:
  - print the masked host and DB name;
  - require typing the DB name;
  - refuse if the URL matches the dev URL in local `.env`, or if the host isn't in `--expect-host`.
- [ ] T049 [US1] Apply the guard to the seed (with an explicit `--i-understand-this-is-production` flag; the default production refusal stays) in backend/app/seed/__main__.py, and to backend/app/auth/create_admin.py (interactive password, success line with no secret)
- [ ] T050 [P] [US1] Add guard tests (dev URL refused; wrong typed name refused; prod path needs the flag; no secret printed) in backend/tests/unit/test_target_guard.py. Existing backend/tests/unit/test_create_admin_cli.py must stay green unchanged.
- [ ] T111 [P] [US1] When the server-only env `API_PROTECTION_BYPASS` is set (Preview only), add `x-vercel-protection-bypass` to server-side API calls in frontend/src/lib/api/http.ts, frontend/src/lib/booking/backend.ts and frontend/src/admin/lib/server.ts. Never in client bundles; never logged. Add tests in frontend/tests/unit/protection-bypass.test.ts (present when set, absent when unset, module is `server-only`).
- [ ] T051 [P] [US1] Create the latency script backend/scripts/measure_latency.py (cold and warm samples, p50/p95/max, configurable URL list; no auth headers or secrets logged), used for C4 and FR-068
- [ ] T052 [US1] Write docs/runbooks/first-deploy.md from quickstart.md, with every owner step marked, including "do not touch Render / kbg-backend"
- [ ] T053 [P] [US1] Write docs/runbooks/smoke-test.md (FR-060): home, catalog page, booking end to end with slip, demo dashboard, admin sign-in page, robots/noindex, no-localhost, website/API demo-switch agreement, security headers, `/health`, `/ready`, no sales copy
- [ ] T054 [US1] 🔑 OWNER ACTION: review and approve the merge of **PR-2** (Phases 4–6 code)

### Launch (owner, guided by Claude)
- [ ] T055 [US1] 🔑 OWNER ACTION: create the Neon project `shuaib-health-prod` in AWS Singapore. Set compute **fixed at 0.25 CU**. **Immediately, while the project is empty**, create branch `preview`; it must never hold production data (playbook §2). Then **reset the app role's password on the `preview` branch** (Neon resets are branch-scoped), so preview and production credentials differ (FR-005, Constitution VII). Check that the preview connection string is refused by the `main` host; Claude provides the one-line check, which prints no URL. create the read-only role `backup_ro`; set history retention to the free maximum (6 h). Store the URLs in your password manager. **No payment method.**
- [ ] T056 [US1] 🔑 OWNER ACTION: generate secrets locally (`BOOKING_PROXY_SECRET`, `PRIVACY_HASH_KEY`, `SESSION_SECRET`, `CRON_SECRET`; different for Production and Preview) with a local generator. Never paste them in chat.
- [ ] T057 [US1] 🔑 OWNER ACTION: create the Vercel project `shuaib-health-api` (import the repo, Root Directory `backend/`, Function region `sin1`). Add the API env vars for Production and Preview per contracts/required-settings.md, including the flags `RATE_LIMIT_STORE=postgres`, `TRUSTED_SERVER_EXEMPT=true` and `MAINTENANCE_VIA_CRON=true`. **No payment method.**
- [ ] T110 [US1] 🔑 OWNER ACTION: in `shuaib-health-api` → Settings → Deployment Protection, enable **Protection Bypass for Automation** (Claude first confirms from Vercel docs that Hobby offers it). Put the value **only** in the website project's **Preview** env as `API_PROTECTION_BYPASS`, never in Production. If Hobby doesn't offer it, tell Claude; the fallback is recorded in plan.md.
- [ ] T058 [US1] 🔑 OWNER ACTION: create the Vercel project `shuaib-health-web` (Root Directory `frontend/`, region `sin1`). Add the website env vars for Production and Preview: `BOOKING_PROXY_SECRET` equal to the API's in the same scope; `CATALOG_API_URL`; `DEMO_ENABLED=true`; `SITE_URL`; `SITE_SECURITY_HEADERS=report`.
- [ ] T109 [US1] 🔑 OWNER ACTION: open a PR so both projects build a **preview**. The API preview build migrates the `preview` branch. Then, from your laptop in a throwaway shell, run the guarded seed against the **preview** direct URL (`--expect-host` = preview host) so preview holds demo data only. Confirm the preview `/ready` = 200, and click through the preview website (booking and demo dashboard work end to end through the protection bypass).
- [ ] T059 [US1] 🔑 OWNER ACTION (share URL only) + Claude measures — **C4 cold-start gate:** the owner shares the API **preview** URL (and a protection-bypass token if Deployment Protection is on). After ≥ 30 min idle, Claude runs backend/scripts/measure_latency.py: 5 cold and 5 warm samples each for `/health`, `/ready`, a catalog GET. Record in specs/007-launch-ready/results/cold-start.md against the targets (warm p95 < 1 s; cold catalog within the BFF timeout; friendly retry shown). **Stop and report to the owner if a target fails.**
- [ ] T060 [US1] 🔑 OWNER ACTION: trigger the first production deploy of `shuaib-health-api` (Redeploy). Confirm the build log shows the migration step succeeded, then `/health` = 200 and `/ready` = 200.
- [ ] T061 [US1] 🔑 OWNER ACTION: from your laptop, in a throwaway shell, run the seed (production flag + guard) and `create_admin` against the prod **direct** URL, per docs/runbooks/first-deploy.md. Close the shell and check the history.
- [ ] T062 [US1] 🔑 OWNER ACTION: run the read-only SQL Claude provides to confirm the production clinic has `indexable = false`
- [ ] T063 [US1] 🔑 OWNER ACTION: open the live API once from your phone, read the `xffHops` value from the Vercel runtime log, and tell Claude only the number. Then set `TRUSTED_PROXY_HOPS` to the value Claude derives, and `CORS_ORIGINS` to the website's production origin; redeploy the API. Claude records the value in docs/runbooks/first-deploy.md.
- [ ] T064 [US1] 🔑 OWNER ACTION: trigger the first production deploy of `shuaib-health-web` and share the production URL
- [ ] T065 [US1] Run docs/runbooks/smoke-test.md against the live URL on desktop (Playwright MCP, read-only) and record in specs/007-launch-ready/results/smoke-<date>.md
- [ ] T066 [US1] 🔑 OWNER ACTION: real-device phone QA on mobile data (Android; iPhone if available). Run the smoke checklist and save screenshots to specs/007-launch-ready/results/phone-qa/
- [ ] T067 [P] [US1] Lighthouse mobile ×3 (median, warm) on the live home and one catalog page, saving JSON and HTML to specs/007-launch-ready/results/lighthouse/. Pass = Performance, Accessibility and Best Practices each ≥ 90 (SC-002). Record the live SEO score with a note if it is lowered only by the "blocked from indexing" audit (expected for the noindex demo).
- [ ] T112 [P] [US1] SEO check on a **test-only** local production build with `indexable=true`: use a temporary local database or fixture override; the seed, fixtures and live data stay unchanged. Lighthouse SEO must be ≥ 90 on home and one catalog page. Save to specs/007-launch-ready/results/lighthouse/seo-indexable-test.md (SC-002).
- [ ] T068 [P] [US1] API p95 on the live API (200 catalog + 20 slot requests, warm) via backend/scripts/measure_latency.py, saved to specs/007-launch-ready/results/p95.md (SC-003)
- [ ] T069 [US1] 🔑 OWNER ACTION: after one clean release with `SITE_SECURITY_HEADERS=report` and no CSP violations in the console or Sentry (Claude checks and reports), set `SITE_SECURITY_HEADERS=enforce` in the website's Production env and redeploy. No code change; Claude reruns frontend/tests/e2e/security-headers.spec.ts against the live URL.

**Checkpoint (MVP)**: live demo works on a phone; SC-001, SC-002, SC-003, SC-008, SC-011 evidenced.

---

## Phase 6: User Story 3 — The owner is alerted and can see why (P1)

**Goal**: phone alerts within 10 minutes; errors captured with no personal data.
**Independent test**: a failing test monitor alerts the phone and then recovers; a test error appears in Sentry fully scrubbed.

- [ ] T070 [US3] Add `sentry-sdk[fastapi]` (Complexity Tracking: justified) to backend/pyproject.toml. Create backend/app/observability.py:
  - init only when `SENTRY_DSN` is set; `send_default_pii=False`;
  - a `before_send` scrubber dropping cookies, auth and proxy headers, query strings and bodies, and masking phone, email and booking-reference patterns;
  - low sample rates.
- [ ] T071 [US3] In backend/app/errors.py (unhandled-exception handler), capture the exception, then call `sentry_sdk.flush(timeout=2)` **before returning the response** (C3: no work after the request)
- [ ] T072 [US3] Add a `CRON_SECRET`-protected `POST /internal/maintenance/sentry-check` to backend/app/routers/maintenance.py. It raises a deliberate error carrying fake personal data in headers and query, so scrubbing can be verified on the live API; 404 without the bearer; not in the schema. Add it to specs/007-launch-ready/contracts/ops-endpoints.md.
- [ ] T073 [P] [US3] Add `@sentry/nextjs` to frontend/package.json, with frontend/sentry.server.config.ts and init in frontend/src/instrumentation.ts (DSN-gated, same scrubber rules; relies on the platform's `waitUntil`, no custom timers)
- [ ] T074 [P] [US3] Add scrubber tests in backend/tests/unit/test_sentry_scrub.py and frontend/tests/unit/sentry-scrub.test.ts, plus a test that the sentry-check route is 404 without the bearer, in backend/tests/api/test_maintenance_purge.py
- [ ] T075 [US3] 🔑 OWNER ACTION: create a Sentry free account (**no card**) with projects `shuaib-health-api` and `shuaib-health-web`. Add `SENTRY_DSN` (and `SENTRY_AUTH_TOKEN` for the website) to the Vercel Production env of each project, then redeploy.
- [ ] T076 [US3] 🔑 OWNER ACTION: in UptimeRobot add the 4 monitors from data-model.md (web `/` 5 min, API `/health` 5 min, API `/ready` 60 min, a catalog page 60 min), with mobile-app push and email. **Do not edit the existing `kbg-backend` monitor.**
- [ ] T077 [US3] 🔑 OWNER ACTION: enable deployment-failure notifications on both Vercel projects
- [ ] T078 [US3] 🔑 OWNER ACTION: alert test. Add a temporary monitor on a URL that returns 404 (e.g. `/health-does-not-exist`), confirm the phone alert arrives within 10 minutes and the recovery notice after deleting it, and tell Claude the times. Claude records them in specs/007-launch-ready/results/alert-test.md (SC-005).
- [ ] T079 [US3] 🔑 OWNER ACTION: call the sentry-check endpoint once with the cron bearer (Claude provides the command, run in your own terminal). Claude then reviews the Sentry event fields you share (no values) and records the scrubbing verdict in specs/007-launch-ready/results/sentry-check.md.

**Checkpoint**: SC-005 evidenced; errors visible without personal data.

---

## Phase 7: User Story 5 — Safe database changes: backup and restore (P2)

**Goal**: daily encrypted off-platform backups (14 days), a tested restore, and a restore point before migrations.
**Independent test**: the restore drill finishes in < 30 min with matching row counts and a known booking.

- [ ] T080 [US5] Write the backup workflow template at docs/runbooks/backup-workflow.yml.example. It is copied into the private repo and contains no secrets:
  - daily `0 21 * * *` UTC;
  - `pg_dump -Fc` via the read-only role;
  - `age` encrypt to `AGE_RECIPIENT`;
  - `upload-artifact` with `retention-days: 14`;
  - fails loudly on any error.
- [ ] T081 [US5] Write docs/runbooks/restore-drill.md: download artifact → `age -d` with the laptop key → `pg_restore` into a new Neon branch → compare row counts and one known booking reference → record duration → delete the scratch branch. Include the **monthly manual Google Drive copy** step (the owner's routine).
- [ ] T082 [P] [US5] Write docs/runbooks/migration-restore-point.md: before merging a PR with a migration, create Neon snapshot or branch `pre-<sha7>-<yyyymmdd>`; how to restore; delete after 14 days or when near the 10-branch limit
- [ ] T083 [US5] 🔑 OWNER ACTION: generate an `age` key pair on your laptop and store the private key in your password manager; share only the **public** key
- [ ] T084 [US5] 🔑 OWNER ACTION: create the **private** GitHub repo `shuaib-health-backups`, add the workflow from T080, and add the secrets `NEON_BACKUP_URL` (read-only role, direct host) and `AGE_RECIPIENT`
- [ ] T085 [US5] 🔑 OWNER ACTION: run the backup workflow once manually; confirm the artifact exists, shows the 14-day expiry, and that a failed run emails you
- [ ] T086 [US5] 🔑 OWNER ACTION (Claude guides live): perform the restore drill per docs/runbooks/restore-drill.md. Claude records the result in specs/007-launch-ready/results/restore-drill.md (SC-007).
- [ ] T087 [US5] 🔑 OWNER ACTION: copy the verified backup into your Google Drive (first monthly copy)

**Checkpoint**: SC-007 evidenced.

---

## Phase 8: User Story 6 — One-click rollback and clear runbooks (P2)

**Goal**: rollback in minutes by following a document; incident notes and env-var checklist exist.
**Independent test**: the owner rolls back website and API using only the runbook, timed.

- [ ] T088 [P] [US6] Write docs/runbooks/deploy.md: routine deploy (CI green → restore point if migration → merge → watch both builds → smoke test)
- [ ] T089 [P] [US6] Write docs/runbooks/rollback.md: Vercel Instant Rollback per project; DB downgrade or Neon restore; demo switch both sides + redeploy; "never enable billing" note
- [ ] T090 [P] [US6] Create docs/incidents/TEMPLATE.md (what broke, impact, timeline, cause, fix, prevention test)
- [ ] T091 [P] [US6] Write docs/runbooks/new-env-var.md (`.env.example`, required-settings contract, both Vercel projects × Production and Preview, redeploy, smoke)
- [ ] T092 [P] [US6] Write docs/runbooks/secret-rotation.md (per secret: where it is set, the side effects such as sign-out or fingerprint change, the order across the two projects)
- [ ] T093 [P] [US6] Write docs/runbooks/custom-domain-prep.md (FR-024): settings to change (`SITE_URL`, `CORS_ORIGINS`, HSTS preload later), checks to re-run, and a sign-in check on the new origin (audit E1). No purchase.
- [ ] T094 [US6] Link the runbooks from docs/SAFE-CHANGE-PLAYBOOK.md §4 and §7 and from docs/runbooks/README.md (FR-072)
- [ ] T095 [US6] 🔑 OWNER ACTION: rehearse rollback on live: Instant Rollback the website and then the API to the previous deployment, then forward again, following only docs/runbooks/rollback.md. Claude times it and records in specs/007-launch-ready/results/rollback-rehearsal.md (SC-006).
- [ ] T096 [US6] 🔑 OWNER ACTION: review and approve the merge of **PR-3** (runbooks and docs)

---

## Phase 9: User Story 7 — Free-tier fit at $0 (P2)

**Goal**: everything stays ≤ 80% of free allowances; no billing anywhere; the burger site is unaffected.
**Independent test**: the day-7 usage projection is ≤ 80% for every allowance; total spend is $0.

- [ ] T097 [P] [US7] Write docs/runbooks/free-tier-usage.md: where to read usage for Vercel (shared Hobby allowance for both projects), Neon (CU-h, storage), GitHub Actions (private backups repo minutes), UptimeRobot and Sentry; the projection formula; what to switch off first (hourly DB monitors, then cron); "pause until month end, never enable billing"
- [ ] T098 [P] [US7] Write docs/runbooks/plan-fit.md (FR-073): each limit, today's projection, and what changes before the first paying client (Vercel Pro for both projects, a Neon plan without forced scale-to-zero). Note that this is not purchased now.
- [ ] T099 [US7] 🔑 OWNER ACTION: confirm there's no payment method or billing enabled on Vercel, Neon, Sentry or UptimeRobot, and that the Render workspace still shows only `kbg-backend` with unchanged hours
- [ ] T100 [US7] 🔑 OWNER ACTION: 7 days after launch, share the usage numbers (not credentials) from each dashboard. Claude computes the month-end projection in specs/007-launch-ready/results/usage-day7.md (SC-010).

---

## Phase 10: Polish and cross-cutting

- [ ] T101 Run every suite once, sequentially, in clean runs, and compare with the baseline (no test deleted or loosened). Record in specs/007-launch-ready/results/final-suites.md.
- [ ] T102 [P] Final gitleaks (full history), npm audit, pip-audit; append to specs/007-launch-ready/results/final-suites.md
- [ ] T103 [P] Update specs/007-launch-ready/spec.md status to "Implemented", correct quickstart.md with anything learned at launch, and add result links to history/adr/0011-launch-hosting-and-deploy-strategy.md
- [ ] T104 🔑 OWNER ACTION: final sign-off. Review specs/007-launch-ready/results/ against SC-001–SC-012 and declare the launch done.

---

## Dependencies and execution order

- **Phase 1 → Phase 2** (blocking) → **Phase 3 (US2 CI)** → PR-1 merge (T039).
- **Phase 4 (US4)** and the code parts of **Phase 5 (US1)** and **Phase 6 (US3)** can proceed in parallel after PR-1 → PR-2 merge (T054).
- **Launch tasks T055–T068** need PR-2 merged. Launch order: T055 → T056 → T057 → T110 → T058 → **T109 (preview migrated, seeded and clicked through)** → **T059 (C4 cold-start gate on preview)** → T060 (production). T059 must pass before T060.
- **CI gates before PR-1 merges**: T113, T114, and T115 → T116 (Linux baselines approved) must be done before T039.
- **Existing-test guards**: T107 after T014; T108 after T040–T042. Either one stopping blocks the PR until the owner decides.
- **Phase 6 owner tasks (T075–T079)** need the live deployment (T060, T064).
- **Phase 7 (US5)**: T080–T082 can be written anytime; T083–T087 need the production DB (T055, T061).
- **Phase 8 (US6)**: docs anytime; T095 needs two production deployments of each project.
- **Phase 9 (US7)**: T100 runs 7 days after T064.
- **Phase 10** last.

### Parallel examples
- Phase 2: T007, T012, T015, T017, T020, T025, T026 in parallel once their implementation tasks exist (different files).
- Phase 4: T042, T043, T044 together.
- Phase 5: T046, T047, T050, T051, T053 together; T067 and T068 together.
- Phase 8: T088–T093 all in parallel.

## Implementation strategy

1. **MVP** = Phases 1–5: a protected repo, safe serverless backend, fair limits, a live demo that passes smoke, Lighthouse and p95, with the C4 gate passed.
2. Then **US3** (alerts) on the same day as launch, so the live demo is never unmonitored for long; T076 directly follows T064.
3. Then **US5 → US6 → US7** (data safety, runbook rehearsal, free-tier check).

## Owner action index

T116, T038, T039, T054, T055, T056, T057, T110, T058, T109, T059 (share URL), T060, T061, T062, T063, T064, T066, T069, T075, T076, T077, T078, T079, T083, T084, T085, T086, T087, T095, T096, T099, T100, T104 (33 tasks; merges = T039, T054, T096, done by your merge click)
