# Quickstart: First Deploy of the Public Demo (owner-run)

Run this **after** Phases 1–3 are merged. The owner creates accounts and clicks; nothing here is automated by Claude. Never paste secret values into chat.

## 0. Before you start
- [ ] The constitution amendment (backend on Vercel) is merged and ADR-0011 is Accepted.
- [ ] `main` CI is green.
- [ ] No sales copy, prices or "hire us" buttons on the site (FR-075).
- [ ] Your Render workspace and the `kbg-backend` UptimeRobot monitor are **not touched** at any step.

## 1. Neon (Singapore)
1. New project `shuaib-health-prod`, region **AWS Asia Pacific (Singapore)**. Set compute to a **fixed 0.25 CU** (no autoscaling).
2. **Immediately** (while the project is still empty, before any deploy or seed) create branch `preview` from `main`. It must never contain production data. Then reset the app role's password **on the preview branch**, so its credentials differ from production.
3. Create a role `backup_ro` with read-only grants on `main`.
4. Copy the pooled and direct URLs for `main` and `preview` into your password manager.

## 2. Vercel: API project
1. Import the repo → project `shuaib-health-api`, **Root Directory `backend/`**.
2. Settings → Functions → region **Singapore (sin1)** (also set in `backend/vercel.json`).
3. Add env vars per `contracts/required-settings.md`, choosing Production or Preview scope for each.
4. Set the flags explicitly: `RATE_LIMIT_STORE=postgres`, `TRUSTED_SERVER_EXEMPT=true`, `MAINTENANCE_VIA_CRON=true`.
5. Settings → Deployment Protection → enable **Protection Bypass for Automation**. Put its value **only** in the website project's **Preview** env as `API_PROTECTION_BYPASS`.
6. Open a preview deploy first: the preview build migrates the `preview` branch. Seed it with demo data (guarded seed, preview host), then run the cold-start gate (C4) before any production deploy.
7. Deploy production. The production build runs `alembic upgrade head`.
8. Check `https://<api>/health` → 200 and `/ready` → 200.

## 3. First seed + first admin (laptop, once)
1. Open a fresh terminal and set `DIRECT_DATABASE_URL` / `DATABASE_URL` to the **prod `main`** values for this shell only.
2. Run the seed with its production flag. The guard shows the masked host and DB name; type the DB name to confirm.
3. Run `create_admin`; enter the password interactively.
4. Close the terminal. Check the shell history holds no URL.
5. Confirm the production clinic has `indexable = false`.

## 4. Measure proxy hops
Call a temporary debug-safe check (or read the structured log line) once from your phone. Count the `X-Forwarded-For` entries, set `TRUSTED_PROXY_HOPS`, redeploy, and record the value in `docs/runbooks/first-deploy.md`.

## 5. Vercel: website project
1. Import the repo → project `shuaib-health-web`, **Root Directory `frontend/`**, region **sin1**.
2. Set env vars (production and preview). `BOOKING_PROXY_SECRET` must equal the API's value in the same scope.
3. Deploy, then set the API's `CORS_ORIGINS` to the website's production origin and redeploy the API.

## 6. Monitoring, errors, alerts
- UptimeRobot: 4 monitors (see data-model.md), mobile-app push and email.
- Sentry: two projects (website, API); set the DSNs; trigger one test error each and check scrubbing.
- Vercel: enable deployment-failure notifications on both projects.

## 7. Backups
1. Create the **private** repo `shuaib-health-backups` with the backup workflow from `docs/runbooks/restore-drill.md`.
2. Add `NEON_BACKUP_URL` (read-only role) and `AGE_RECIPIENT`.
3. Run it once manually; check the artifact has a 14-day expiry.
4. Do the restore drill now and record it in `specs/007-launch-ready/results/`.

## 8. Lock the door
- Branch protection on `main` (contracts/ci-checks.md): 4 required checks, 0 approvals, admins included, no force-push. Your merge click is the approval.
- Website env: `SITE_SECURITY_HEADERS=report` at launch; switch to `enforce` and redeploy after one clean release.
- Run gitleaks over the full history once.

## 9. Verify (Phase 5)
Run the live smoke checklist (`docs/runbooks/deploy.md`) on desktop and on a real phone on mobile data. Then run Lighthouse ×3, the p95 script and the cold-start measurement, and rehearse a rollback. Save everything in `results/`. After 7 days, run the free-tier usage check.
