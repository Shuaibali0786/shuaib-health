# Rollback

Use when a release is live and visitors are affected. **Roll back first, investigate after.** 🔑 = owner. Rolling back needs the owner's go-ahead; nothing here is done by Claude on its own.

Remember: **merging to `main` auto-deploys production**, so a bad merge is live within minutes. Reverting in Git alone also redeploys, but Instant Rollback is faster.

## Decide what broke
| Symptom | Likely part | Go to |
|---|---|---|
| Website pages broken or blank | website | A |
| `/health` or `/ready` fail, booking errors, catalog "temporarily unavailable" | API | B |
| Wrong data / migration problem | database | C |
| Demo button misbehaving | demo switch | D |

## A. Website (project `shuaib-health-web`)
1. 🔑 Vercel -> `shuaib-health-web` -> Deployments.
2. Open the last deployment that was good (the one before the bad merge) -> **Instant Rollback** (or "Promote to Production").
3. Check `/`, a doctor page, `/book-appointment`.
> Instant Rollback pauses Git auto-deploys for that project until you promote or redeploy again. Note that in the incident note.

## B. API (project `shuaib-health-api`)
1. 🔑 Vercel -> `shuaib-health-api` -> Deployments -> the last good deployment -> **Instant Rollback**.
2. Check `https://shuaib-health-api.vercel.app/health` and `/ready` return 200.
3. Migrations are additive (playbook rule 8), so the previous code still runs against the migrated database.

If the dashboard asks for a verification code you cannot receive (6 Nov 2026 blocker), use the Vercel API or CLI to promote the earlier deployment; STATUS-2026-11-06.md records the previous production deployment ids as examples. Ask Claude for the exact command; no token is ever pasted into chat.

## C. Database
1. Prefer rolling forward with a fix. A failed migration leaves the old deployment live (the build stops).
2. If a migration must be undone: run its tested `alembic downgrade` (one step) against the **direct** URL from a throwaway shell, with the target guard, after taking a restore point.
3. Data lost or damaged: restore from the Neon restore point `pre-<sha7>-<date>` (`migration-restore-point.md`) or the latest encrypted backup (`restore-drill.md`). Never restore into `production` before checking the scratch branch.

## D. Demo switch off
The demo is switched on both sides: `DEMO_ENABLED` on the website and `DEMO_MODE` / `DEMO_ENABLED` on the API must agree.
1. 🔑 Set `DEMO_ENABLED=false` on `shuaib-health-web` (Production) and `DEMO_ENABLED=false` on `shuaib-health-api`.
2. Redeploy both (variables take effect only on a new deployment, about 1 to 2 minutes), or Instant Rollback to a deployment where it was off.
3. Check the demo button is gone.

## Other flags
`SITE_SECURITY_HEADERS` (website): set back to `report` or `off`, redeploy. `RATE_LIMIT_STORE`, `TRUSTED_SERVER_EXEMPT`: change and redeploy the API (`MAINTENANCE_VIA_CRON=false` is not allowed in production).

## After every rollback
- Run `smoke-test.md`.
- Write an incident note from `../incidents/TEMPLATE.md` (what broke, impact, timeline, cause, fix, a test that would have caught it).
- Fix on a branch; the fix goes through CI like any change.

## Never
Never enable billing to "fix" a limit: if a free allowance runs out, the demo pauses until month end. Never delete data or change a plan without asking.
