# Secret rotation

🔑 = owner. Generate every value locally (`openssl rand -hex 32`) and keep it in the password manager. Never paste a secret into chat. Production and Preview must always have **different** values.

Rotate when: a secret may have been seen (screenshot, chat, log), a person with access leaves, or on the schedule you choose. After any rotation, redeploy the project (variables apply only to a new deployment) and run `smoke-test.md`.

| Secret | Where it is set | Side effects | Order |
|---|---|---|---|
| `SESSION_SECRET` | API (Production, Preview) | **Everyone is signed out** (staff and the demo session). | Set, redeploy API, sign in again. |
| `BOOKING_PROXY_SECRET` | API **and** website, same scope, same value | Booking and catalog calls from the website fail until both match (catalog falls back to last-good data, booking shows the friendly retry). | Change on both projects first, then redeploy **API, then website**, back to back. Do it at a quiet time. |
| `PRIVACY_HASH_KEY` | API | Stored fingerprints and rate-limit buckets stop matching (limits reset; duplicate detection for older bookings no longer links). Not reversible. | Rotate only if exposed. Redeploy API. |
| `CRON_SECRET` | API (Vercel sends it to the cron endpoint) | The daily purge fails (404) until the API is redeployed with the new value. | Set, redeploy API, confirm the next cron run succeeds. |
| `SENTRY_DSN` | each project, Production | New events go to the new project key. Old DSN stops working if revoked in Sentry. | Create a new key in Sentry, set, redeploy, then revoke the old one. |
| `API_PROTECTION_BYPASS` | website Preview only | Preview builds cannot reach the protected API preview until updated. | Regenerate in the API project, update website Preview, redeploy previews. |
| Database role passwords (app role, `backup_ro`) | Neon, then Vercel (`DATABASE_URL`, `DIRECT_DATABASE_URL`) and GitHub backups repo (`NEON_BACKUP_URL`) | Connections using the old password fail. Resets in Neon are **branch-scoped**: do production and preview separately. | Reset in Neon, update Vercel, redeploy API, update the backup secret, run the backup workflow once. |
| age private key | password manager only | Old backups need the old key. | Generate a new pair, update `AGE_RECIPIENT`, keep the old private key until old backups expire (14 days) and the Drive copies are retired. |

## If a secret was exposed
1. Rotate it first (this page), then write an incident note (`../incidents/TEMPLATE.md`).
2. Check Git history with gitleaks if it might have been committed.
3. Never describe the value in the note.
