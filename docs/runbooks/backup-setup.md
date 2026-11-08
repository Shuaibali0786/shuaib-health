# Backup setup (T083 to T087)

Daily encrypted off-platform backups, 14 days kept. Everything here is **owner-run**; Claude has prepared the pieces and never sees the age private key or the database URL. Nothing here writes to the production database: the workflow only reads, through the read-only role `backup_ro`.

## What you need to provide (the whole list)
| # | What | Where it comes from | Who sees it |
|---|---|---|---|
| 1 | An **age key pair** | made by the helper script on your laptop | Private key: only you (password manager). Public key: safe to share |
| 2 | The **private repo** `shuaib-health-backups` | created by the helper script under your GitHub account | you |
| 3 | `NEON_BACKUP_URL` | Neon -> `production` branch -> role `backup_ro` -> **direct** (no `-pooler`) connection string | typed into a hidden prompt; stored as a GitHub secret; never in chat |
| 4 | `AGE_RECIPIENT` | the public key from step 1 | stored as a GitHub secret (not secret by nature) |
| 5 | A **Google Drive folder** `shuaib-health-backups` | your Drive | you (monthly manual copy) |
| 6 | Tools on the laptop | `age`, `age-keygen`, `gh`, `git`; later `pg_restore`/`psql` 17 for the drill | you |

Before step 3, confirm the `backup_ro` role exists on the `production` branch with read-only grants (done in T055; its password was reset after the 12 Oct screenshot incident, so use the **new** connection string).

## B. Daily encrypted backup: setup steps
1. **T083 + T084 + T085**: read `scripts/backups/setup-backup-repo.ps1`, then run it from the repo root:
   `powershell -ExecutionPolicy Bypass -File scripts\backups\setup-backup-repo.ps1`
   It creates the key, the private repo with the workflow (`backup-workflow.yml.example`), the two secrets, and starts one run.
2. Check the run: GitHub -> `shuaib-health-backups` -> Actions -> `backup`. It must be green and show an artifact `shuaib-health-backup` that expires in 14 days.
3. Check that **a failed run emails you**: GitHub -> Settings -> Notifications -> Actions: email on failed workflows must be on. (Optional test: temporarily set a wrong `NEON_BACKUP_URL` secret, run once, confirm the email, then restore the right value.)
4. **T086** restore drill: `restore-drill.md`. Claude guides live and records `results/restore-drill.md`.
5. **T087** copy the verified `.dump.age` into the Drive folder (encrypted, so Drive only holds ciphertext). Repeat monthly; keep 3.

## Two layers of backup (what protects what)
| Layer | Covers | Kept for | Cost |
|---|---|---|---|
| **A. Neon instant restore** (built in, nothing to set up) | "I broke data in the last few hours" | Free plan: up to **6 hours**, max 1 GB of change history per project | free |
| **B. Daily encrypted `pg_dump`** (this runbook, steps 1-5) | anything older than 6 hours; Neon account loss | 14 days in GitHub + 3 monthly copies in Drive | free |

Neon limits checked on 7 Nov 2026 in the Neon docs (History window, Backups). Re-check them in the console before relying on them.

## A. Neon instant restore (owner, Neon console)
Use this only for a mistake made **less than 6 hours ago**. It rewrites the whole branch, so stop and ask first if unsure.
1. Note the time just **before** the mistake (UTC).
2. 🔑 Neon console → project `shuaib-health-prod` → **Restore** (or Branches → `production` → Restore). Pick "point in time" and enter that time.
3. Prefer **"Preview"/"Time Travel"** first: run the read-only `scripts/backups/drill-counts.sql` against the chosen time to confirm it is the right moment.
4. Restore. Neon keeps the pre-restore state as a **backup branch**, so the restore itself can be undone. Do not delete that branch until the site is checked.
5. Run `smoke-test.md`. Then write an incident note (`docs/incidents/TEMPLATE.md`).

Older than 6 hours: use layer B (part C below, but restore into a **new** branch and then switch the app only after review, with Claude's help).

## C. Monthly restore drill (owner, about 30 minutes, first Saturday of each month)
Script: `scripts/backups/restore-drill.ps1` (read it first; it decrypts, restores into a scratch branch, runs the read-only counts, and always deletes the decrypted file). Full narrative: `restore-drill.md`.
1. GitHub → `shuaib-health-backups` → Actions → newest green `backup` run → download and unzip the artifact.
2. Neon console → Branches → create `restore-drill-YYYYMMDD` from `production`.
3. Copy the age private key from the password manager to a temporary file (default path the script expects: `%USERPROFILE%\.shuaib-health-age\key.txt`).
4. `powershell -ExecutionPolicy Bypass -File scripts\backups\restore-drill.ps1 -Backup <path-to>.dump.age`, answer the prompts (the URL prompt is hidden).
5. Run `scripts/backups/drill-counts.sql` against `production` with the read-only role and compare: everything matches except bookings/audit rows created after the backup time.
6. Delete the scratch branch; delete the temporary key copy; keep the `.dump.age` in Drive (step 5 of the setup list).
7. Add one line to `specs/007-launch-ready/results/restore-drill.md`: date, backup date, minutes, pass/fail.

Pass: under 30 minutes, counts match, one known booking found, scratch branch and decrypted files gone.

## Limits to know
- GitHub Actions minutes for a **private** repo are limited on the free plan; one daily dump is a few minutes a month. Watch it in `free-tier-usage` (T097).
- Scheduled workflows in a repo with no activity can be disabled by GitHub after 60 days: make a small commit or re-enable the workflow if you get that notice.
- Losing the age private key makes every backup unreadable. Keep it in the password manager and in a second safe place.
