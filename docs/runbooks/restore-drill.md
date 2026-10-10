# Restore drill

Proves a backup can be turned back into a working database. Do it once at launch (T086) and then every quarter. Target: **under 30 minutes**, with matching row counts and one known booking found.

🔑 = only the owner can do this. Claude guides live and records the result in `specs/007-launch-ready/results/restore-drill.md`. Never paste a database URL or the age private key into chat.

## What you need
- The age **private** key (password manager) saved to a temporary file on your laptop.
- `age`, and `pg_restore` / `psql` version 17 on your laptop.
- A Neon **scratch branch** of `main` (made in step 3). Never restore into `main`.

## Steps
Start a timer.

1. 🔑 GitHub → `shuaib-health-backups` → Actions → the latest `backup` run → download the artifact `shuaib-health-backup` and unzip it. You get `shuaib-health-<date>.dump.age`.
2. 🔑 Decrypt: `age -d -i <private-key-file> -o restore.dump shuaib-health-<date>.dump.age`
3. 🔑 Neon console → project `shuaib-health-prod` → Branches → **Create branch** `restore-drill-<yyyymmdd>` from `main` (empty data is fine; a copy is also fine). Copy its **direct** connection string into a throwaway terminal variable only.
4. 🔑 Restore: `pg_restore --clean --if-exists --no-owner --no-privileges -d "$SCRATCH_URL" restore.dump` (warnings about missing roles are normal; errors about data are not).
5. 🔑 Compare row counts between the scratch branch and `main`, using the read-only SQL Claude gives you (counts only: `department`, `doctor`, `lab_test`, `appointment`, `staff_account`). They must match, allowing for bookings made after the backup time.
6. 🔑 Look up one known booking reference on the scratch branch and confirm it exists.
7. Stop the timer. Write the duration down.
8. 🔑 **Clean up**: delete the scratch branch in Neon; delete `restore.dump`, the decrypted copy and the private-key file from your laptop; close the terminal and check that its history holds no URL.

## Pass
- Finished in under 30 minutes.
- Row counts match, one known booking found.
- Scratch branch and decrypted files are gone.

## Monthly copy (the owner's routine)
Once a month, download the newest `.dump.age` artifact and put it in your Google Drive folder `shuaib-health-backups`. It is encrypted, so Drive only holds ciphertext. Keep the last 3 copies. This is the off-GitHub copy: if GitHub is unavailable you still have a recent backup.

## If it fails
Do not delete the backup artifact. Write down the first error line (no URLs), tell Claude, and keep the scratch branch until it is understood.
