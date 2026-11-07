# Results: 011 admin two-step sign-in (2026-11-07)

**Status: built and tested. Draft PR, NOT merged.** The production migration needs Shuaib's approval (`docs/runbooks/migration-0004.md`).

## Tests (local, Windows, one suite at a time)
| Suite | Result |
|---|---|
| Backend unit: TOTP RFC 4226/6238 vectors, window, replay; secret box; backup codes; key validation | 31 passed |
| Backend API `test_two_factor.py`: sign-in with code, backup code, replay, ±1/±2 steps, 5 attempts, shared lockout, a correct password does not reset the counter, expiry, deactivation and password change mid-step, no key → 503 and never password-only, setup/enable, refusals, demo read-only, admin reset, self refused, receptionist refused, operator reset, new codes, turn off, no codes or secrets in logs or audit rows | 25 passed |
| Backend migrations (round trip ×2, models = migrations, 0001–0003 tests) | 18 passed |
| Backend contract (v1.3.0, 26 admin ops), route policies, auth matrix (26 rows × 5 viewers) | 367 + 332 passed |
| Backend retention (expired challenges purged after 1 day) | passed |
| Backend ruff + mypy (188 files) | clean |
| Frontend typecheck + lint | clean |
| Frontend Vitest (all) | 1529 passed (116 files) |
| Playwright `admin-two-factor.spec.ts` on admin-desktop and admin-mobile (code step, backup code, start again, cookie flags, Security enrolment, receptionist/demo, axe on the code step and the Security page) | 10 passed |
| Playwright admin projects (full, 4 sizes) | local run stopped by the memory guard after 6 min (test servers killed mid-run); relies on GitHub CI |
| Backend pytest (full) | local run stopped by the memory guard; the targeted suites above passed; relies on GitHub CI |

## Manual checks (SC-001, SC-006)
- Enrolment in the browser (mock): 3 steps, under a minute.
- Recovery: admin reset (API test) and the operator command (API test) both turn it off at once.

## Incident
The pushed branch triggered an API **preview** build. `vercel_build.py` migrates preview builds, so 0004 is on the **preview** database. Production was not touched. See `docs/runbooks/migration-0004.md`, "Incident note".
