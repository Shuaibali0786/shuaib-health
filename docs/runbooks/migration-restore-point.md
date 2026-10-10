# Restore point before a migration

Any pull request that adds or changes a database migration needs a restore point **before** it is merged to `main`, because merging deploys the API and its build runs the migration on production.

How to know: the PR changes files under `backend/migrations/`.

## Create (🔑 owner, 2 minutes)
1. Neon console → project `shuaib-health-prod` → Branches → **Create branch** from `main`.
2. Name it `pre-<sha7>-<yyyymmdd>`, where `<sha7>` is the first 7 characters of the PR's last commit and the date is today (for example `pre-3bdecb3-20261010`).
3. Write the name in the PR description under "Restore point".

A branch is instant and copies nothing until data changes, so it costs almost no storage. Do not put anything else on it.

## Restore (if the migration went wrong)
1. Roll back the API to the previous deployment (see `rollback.md`) so the old code is live again.
2. If the old code cannot run against the migrated database: Neon console → Branches → on `pre-<sha7>-<yyyymmdd>` choose **Restore** to `main` (restores `main` to that point). Anything written after the restore point is lost, so use it only when the data is already damaged.
3. Run `/ready` on the API: it must answer 200.

## Clean up
Delete the branch after **14 days** with no problems, or earlier when the project nears Neon's free **10-branch limit** (`main`, `preview`, one restore point each, and any scratch branch).
