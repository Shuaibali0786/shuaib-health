# Migration 0004 (two-step sign-in) on production

🔑 = owner. Do not start until Shuaib has approved PR "Admin two-step sign-in" in writing.

## What it changes (additive only)
- `staff_account`: 4 new **nullable** columns (`totp_secret_encrypted`, `totp_enabled_at`, `totp_last_step`, `totp_setup_started_at`) and one CHECK constraint (only "on" when a secret exists).
- 2 new tables: `staff_backup_code` and `staff_sign_in_challenge`. Both start empty, with foreign keys to `staff_account ON DELETE CASCADE`.
- 2 CHECK constraints replaced by **supersets**:
  - `audit_log.action` gains 7 two-step names.
  - `staff_session.end_reason` gains `two_factor_reset`.
- No row is updated or deleted. No column is dropped or renamed.

## Steps
1. 🔑 **Restore point** (`migration-restore-point.md`): Neon → `shuaib-health-prod` → Branches → create `pre-<sha7>-<yyyymmdd>` from `production`, using the PR's last commit. Write its name in the PR.
2. 🔑 **Key** (optional before merge; the feature stays off without it): add `TWO_FACTOR_KEY` to `shuaib-health-api` for Production (and a different value for Preview). See `two-factor.md`.
3. Check the PR: all 4 required checks are green and the branch is up to date with `main`.
4. **Merge**. Vercel builds the API, and `scripts/vercel_build.py` runs `alembic upgrade head` on production with the direct URL. The website deploys separately.
5. Check:
   - The API build log shows `vercel_build: migrations are at head`.
   - `/health` and `/ready` answer 200.
   - The smoke test passes (`smoke-test.md`).
   - An admin signs in (no code asked yet) and Security shows the right state.
6. If the key is set: enrol one admin, sign out, sign in with the code, and check Activity.

## Risk
- **Locks**: adding nullable columns is metadata-only. Replacing a CHECK makes Postgres scan `audit_log` and `staff_session` under a short exclusive lock. These tables are small (thousands of rows), so this takes well under a second. Sign-ins and status changes in that moment wait, then continue.
- **Failed migration**: the build stops, so the old API stays live (the script exits non-zero). Nothing is half-applied, because Alembic runs the whole migration in one transaction on Postgres.
- **Old code after rollback**: Instant Rollback of the API is safe. The old code ignores the new columns and tables, and the new CHECK lists contain every old value.
- **New dependency**: `cryptography` makes the API function a few MB larger, still far below Vercel's limit.
- **Preview database**: already at 0004 since 2026-11-07, because the preview build of this branch migrated it (incident, see below). Until this PR is merged, API preview builds of *other* branches may fail at the migration step ("Can't locate revision 0004_two_factor").

## Rollback
1. Code: Vercel Instant Rollback of `shuaib-health-api` (and of `shuaib-health-web` if needed) to the deployments before the merge. The schema can stay.
2. Schema (only if really needed, 🔑 with approval): from a throwaway shell with the **direct** production URL and the target guard, run `uv run alembic downgrade 0003_command_centre`. This drops the two tables and four columns, **deleting every enrolment and backup code**. The old CHECK lists come back `NOT VALID`, so audit rows with the new names are kept.
3. If data was damaged: restore `production` from the restore point (`migration-restore-point.md`).

## Incident note (2026-11-07)
Pushing the feature branch triggered an API **preview** build, which ran this migration on the **preview** database before approval. Production was not touched. The preview database was left as it is (no further writes without approval). Lesson: a branch with a migration must not be pushed before the owner approves the preview migration.
