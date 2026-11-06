# Adding an environment variable safely

🔑 = owner (secret values are entered by you, never typed into chat).

Because **merging to `main` auto-deploys production**, the variable must exist in Vercel *before* the code that needs it is merged. Otherwise production starts without it (a production build or start fails, naming the setting, for required settings).

## Steps
1. **Code branch**
   - Add the setting to `backend/app/settings.py` or the frontend reader, with a safe default (flags default OFF; Playbook rule 7).
   - Add a placeholder (never a real value) to `backend/.env.example` / `frontend/.env.example`.
   - Add a row to `specs/007-launch-ready/contracts/required-settings.md`: secret or not, required in production or not, Production and Preview values.
   - Add a test for the default and, if it is required in production, for the startup error that names it.
2. 🔑 **Vercel, both projects as needed** (API: `shuaib-health-api`; website: `shuaib-health-web`)
   - Settings -> Environment Variables -> add for **Production** and **Preview**.
   - Secrets: mark Sensitive. Use a **different value** for Production and Preview. If both sides must match (`BOOKING_PROXY_SECRET`), set the same value on both projects *in the same scope*.
   - Website variables read at build time (for example `DEMO_ENABLED`, `SITE_SECURITY_HEADERS`) only change with a new build.
3. **Open the PR.** The preview builds with the Preview values; click through it.
4. 🔑 **Merge** when CI is green (this deploys production: `deploy.md`).
5. **Smoke test** (`smoke-test.md`). Confirm the feature that uses the variable works.
6. If the variable was added *after* a deploy: 🔑 Redeploy that project (Deployments -> Redeploy) so it takes effect.

## Rules
- Never put a secret in code, a commit, a screenshot or chat. If one is shown by accident, reset it before first use and write an incident note (`../incidents/TEMPLATE.md`).
- Test-only variables must stay **unset** in Vercel (`TEST_DATABASE_URL`, `NEXT_DIST_DIR`, `CATALOG_DATA_REVALIDATE_SECONDS`).
- `API_PROTECTION_BYPASS` is Preview scope only, never Production.
