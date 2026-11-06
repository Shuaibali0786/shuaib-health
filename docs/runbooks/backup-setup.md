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

## Steps
1. **T083 + T084 + T085**: read `scripts/backups/setup-backup-repo.ps1`, then run it from the repo root:
   `powershell -ExecutionPolicy Bypass -File scripts\backups\setup-backup-repo.ps1`
   It creates the key, the private repo with the workflow (`backup-workflow.yml.example`), the two secrets, and starts one run.
2. Check the run: GitHub -> `shuaib-health-backups` -> Actions -> `backup`. It must be green and show an artifact `shuaib-health-backup` that expires in 14 days.
3. Check that **a failed run emails you**: GitHub -> Settings -> Notifications -> Actions: email on failed workflows must be on. (Optional test: temporarily set a wrong `NEON_BACKUP_URL` secret, run once, confirm the email, then restore the right value.)
4. **T086** restore drill: `restore-drill.md`. Claude guides live and records `results/restore-drill.md`.
5. **T087** copy the verified `.dump.age` into the Drive folder (encrypted, so Drive only holds ciphertext). Repeat monthly; keep 3.

## Limits to know
- GitHub Actions minutes for a **private** repo are limited on the free plan; one daily dump is a few minutes a month. Watch it in `free-tier-usage` (T097).
- Scheduled workflows in a repo with no activity can be disabled by GitHub after 60 days: make a small commit or re-enable the workflow if you get that notice.
- Losing the age private key makes every backup unreadable. Keep it in the password manager and in a second safe place.
