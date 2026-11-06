# Routine deploy

**Merging a PR to `main` deploys production automatically** for both Vercel projects (Git integration). There is no separate "deploy" button to press. The merge click is the release, so everything below happens *before* it.

🔑 = only the owner can do this.

## 1. Before you merge
- [ ] All four required checks are green on the PR: `backend`, `frontend`, `secrets`, `e2e`. (Branch protection will not let you merge otherwise.)
- [ ] The PR's Vercel previews (website and API) built and you clicked through the preview.
- [ ] **Migration in the PR?** (files under `backend/migrations/`) 🔑 Create the Neon restore point first: `migration-restore-point.md`. The API build runs the migration on production at deploy time.
- [ ] **New environment variable?** Add it to both Vercel projects (Production and Preview) *before* merging: `new-env-var.md`. Changing a variable only takes effect on a new deployment.
- [ ] Release is a good time? Avoid merging while a clinic is mid-demo.

## 2. Merge (🔑 this is the deploy)
Merge the PR on GitHub. Vercel starts a production build for the website and for the API.

## 3. Watch both builds
In Vercel, open `shuaib-health-api` and `shuaib-health-web` -> Deployments. Both must reach **Ready**.
- API build log shows the migration step succeeded (`alembic upgrade head`).
- If a build fails, the previous deployment stays live (nothing is broken for visitors). Read the build log, fix on a branch, open a new PR. Do not merge a "fix" without CI.

## 4. Smoke test
Run `smoke-test.md` (about 5 minutes). Quick version: `/health` and `/ready` on the API return 200; the site home, a doctor page, booking and the demo dashboard work.

## 5. If something is wrong
Do not fix it live. Roll back first (`rollback.md`), then fix calmly and write an incident note (`../incidents/TEMPLATE.md`).

## Redeploy without a code change
Needed after changing an environment variable. Vercel -> project -> Deployments -> the latest production deployment -> Redeploy. (If the dashboard asks for a verification code you cannot receive, see the account-recovery blocker in `specs/007-launch-ready/results/STATUS-2026-11-06.md`; the Vercel API/CLI works as a fallback.)

## Never
- Never push to `main` directly, never bypass the checks.
- Never enable billing or add a payment method on any host.
- Never touch Render or the `kbg-backend` service.
