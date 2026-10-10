# First deploy (the public demo)

Written from `specs/007-launch-ready/quickstart.md`. Every step the owner must do is marked 🔑. Claude prepares, guides and checks; Claude never creates accounts and never sees a secret value. **Never paste a secret, a database URL or a token into chat.** Billing stays off everywhere: never add a payment method.

> **Do not touch Render, the `kbg-backend` service, or its UptimeRobot monitor at any step.** Shuaib Health does not use Render.

## 0. Before you start
- [ ] `main` CI is green.
- [ ] The constitution amendment (backend on Vercel) is merged and ADR-0011 is Accepted.
- [ ] No sales copy, prices outside the labelled samples, or "hire us" buttons on the site (FR-075; see `specs/007-launch-ready/results/copy-audit.md`).

## 1. 🔑 Neon (Singapore)
1. Create project `shuaib-health-prod`, region **AWS Asia Pacific (Singapore)**. Set compute to a **fixed 0.25 CU**.
2. **Immediately, while the project is empty**, create the branch `preview`. It must never hold production data. Then reset the app role's password **on the `preview` branch** so its credentials differ from production.
3. Create the read-only role `backup_ro` on `main`. Set history retention to the free maximum (6 h).
4. Store the pooled and direct URLs of `main` and `preview` in your password manager. No payment method.

## 2. 🔑 Secrets (on your laptop)
Generate `BOOKING_PROXY_SECRET`, `PRIVACY_HASH_KEY`, `SESSION_SECRET` and `CRON_SECRET` with a local generator (for example `openssl rand -hex 32`), **different for Production and Preview**. Keep them in your password manager.

## 3. 🔑 Vercel: API project `shuaib-health-api`
1. Import the repo; **Root Directory `backend/`**; Function region **Singapore (sin1)**.
2. Add the environment variables from `specs/007-launch-ready/contracts/required-settings.md` for Production and Preview, including the flags `RATE_LIMIT_STORE=postgres`, `TRUSTED_SERVER_EXEMPT=true`, `MAINTENANCE_VIA_CRON=true`.
3. Settings → Deployment Protection → enable **Protection Bypass for Automation**. Its value goes **only** in the website project's **Preview** environment as `API_PROTECTION_BYPASS`, never in Production.

## 4. 🔑 Vercel: website project `shuaib-health-web`
1. Import the repo; **Root Directory `frontend/`**; region **sin1**.
2. Production and Preview variables: `BOOKING_PROXY_SECRET` (equal to the API's value in the same scope), `CATALOG_API_URL`, `DEMO_ENABLED=true`, `SITE_URL`, `SITE_SECURITY_HEADERS=report`.

## 5. 🔑 Preview first
Open a pull request so both projects build a preview. The API preview build migrates the `preview` branch. Then, from your laptop in a throwaway shell (section 7), run the guarded seed against the **preview** database so preview holds demo data only. Check `/ready` = 200 and click through the preview site (booking and demo dashboard).

## 6. Cold-start gate (before production)
Share the API **preview** URL with Claude. Put the bypass token only in your own terminal as `PROTECTION_BYPASS`, never in chat. After at least 30 minutes idle, run:

```
cd backend
uv run python scripts/measure_latency.py --base-url <api preview url> --label cold \
  --target /health=5 --target /ready=5 --target /api/v1/clinic=5
```

then the same again with `--label warm`. Warm p95 must be under 1 s and the cold catalog request inside the website's timeout. Claude records the numbers in `specs/007-launch-ready/results/cold-start.md`. **If a target fails, stop.**

## 7. 🔑 First production deploy, seed and admin
1. Redeploy `shuaib-health-api` for Production. The build log must show the migration succeeded; `/health` = 200 and `/ready` = 200.
2. On your laptop open a **fresh terminal** (a throwaway shell). Set these for this shell only: `DATABASE_URL` (prod `main`, pooled), `DIRECT_DATABASE_URL` (prod `main`, direct), `APP_ENV=development`, and three throwaway values of at least 32 characters for `BOOKING_PROXY_SECRET`, `PRIVACY_HASH_KEY`, `SESSION_SECRET` (they are not used by these commands). Then, from `backend/`:

```
uv run python -m app.seed --i-understand-this-is-production --expect-host <prod host>
uv run python -m app.auth.create_admin --email <you> --expect-host <prod host>
```

The guard prints the **masked** host and the database name and asks you to **type the database name**. It refuses if the host is not the one you passed (the pooled and direct host of the same Neon database both count), if the database is the dev one named in your local `.env`, or if the name you type is wrong. `create_admin` asks for the password at a prompt (it refuses `--password-stdin` here). Neither command prints a URL or a password.
3. Close the terminal and check that its history holds no URL.
4. 🔑 Run the read-only SQL Claude gives you to confirm the production clinic has `indexable = false`.

## 8. 🔑 Measure proxy hops
Open the live API once from your phone. Read the `xffHops` value in the Vercel runtime log and tell Claude **only the number**. Claude works out `TRUSTED_PROXY_HOPS`; set it, set `CORS_ORIGINS` to the website's production origin, and redeploy the API. Record the value here: `TRUSTED_PROXY_HOPS = ___`.

## 9. 🔑 Website production deploy
Trigger the first production deploy of `shuaib-health-web` and share the production URL with Claude.

## 10. Verify
Run `smoke-test.md` on desktop (Claude) and on a real phone on mobile data (you). Lighthouse mobile ×3, the p95 check and the alert tests follow. Save everything in `specs/007-launch-ready/results/`.

## 11. Monitoring, errors, backups
- UptimeRobot: the 4 monitors in `specs/007-launch-ready/data-model.md`. Do not edit `kbg-backend`.
- Sentry: projects `shuaib-health-api` and `shuaib-health-web`; set `SENTRY_DSN` in each project's Production environment and redeploy; run the sentry-check once (`specs/007-launch-ready/contracts/ops-endpoints.md`).
- Vercel: enable deployment-failure notifications on both projects.
- Backups: `backup-workflow.yml.example`, then `restore-drill.md`.

## 12. Lock the door
Branch protection on `main` (see `ci-checks.md`). Run gitleaks over the full history once. After one clean release with no CSP violations, set `SITE_SECURITY_HEADERS=enforce` on the website's Production environment and redeploy.
