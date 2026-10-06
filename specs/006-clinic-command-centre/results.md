# Results: Feature 006 — Clinic Command Centre

Evidence log. Sections are filled in as tasks complete. Machine: Windows 11 (dev laptop), Node 24, uv/Python 3.12. Branch `006-clinic-command-centre`.

## Baseline — before any Feature 006 change (T001)

Measured at commit `21d966e` (docs only since Feature 005 merged), before T002–T008.

### Backend (from `backend/`)

| Command | Result | Duration |
|---------|--------|----------|
| `uv run ruff check .` | pass | – |
| `uv run mypy` | pass, 100 source files | – |
| `uv run pytest -q` | **430 passed**, 1 skipped (`time.tzset` is not available on Windows), 3 deselected (perf) | 517 s |

### Frontend (from `frontend/`)

| Command | Result | Duration |
|---------|--------|----------|
| `npm run typecheck` / `npm run lint` | pass | – |
| `npm test` (Vitest) | **863 passed** (68 files) | 62 s |
| `npm run test:e2e` | **1044 passed**, 11 skipped (same 11 as Feature 005) | 7.7 min |

`npm run test:e2e:stateful` and `test:e2e:offline` were not re-run for the baseline; Phase 1 does not touch what they cover and Checkpoint 1 does not require them.

### Public route JS (production build, `.next/diagnostics/route-bundle-stats.json`, uncompressed first-load JS)

| Route | kB |
|-------|----|
| `/contact` | 906.4 |
| `/book-appointment` | 699.7 |
| `/doctors` | 500.5 |
| `/health-tips` | 498.2 |
| `/` | 493.0 |
| `/lab-tests` | 484.3 |
| `/departments/[slug]`, `/doctors/[slug]` | 482.2 |
| `/about`, `/departments`, `/health-tips/[slug]` | 479.1 |
| `/book-appointment/confirmed/[reference]` | 470.2 |
| `/_not-found`, `/faq`, `/health-packages`, `/lab-tests/[slug]`, `/privacy`, `/terms` | 463.3 |

Whole `.next/static`: 25 JS files, 1,281,851 bytes; 1 CSS file, 50,690 bytes. (Next 16 no longer prints a per-route size table in `next build`, so these come from the diagnostics file.)

### Lighthouse (mobile, perf preset, simulated throttling, median of 3)

Method as in `specs/005-appointment-booking/results.md`: `next build` + `next start --port 3150` against the mock API (`ok` mode), `npx lighthouse <url> --preset=perf --form-factor=mobile`.

| Page | Performance (3 runs) | Median | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|----------------------|--------|----------|----------|-----|---------------------|
| `/book-appointment` | 54 / 61 / 61 | 61 | 2828 | 2761 | 0.000 | 222.1 |
| `/doctors/dr-ayesha-rahman` | 56 / 48 / 48 | 48 | 4127 | 2171 | 0.000 | 172.9 |

Caveats: the Lighthouse runs happened after the Phase 1 edits to `src/lib/booking/schemas.ts` (13 extra string literals in a zod enum, no other public code changed) and while the backend `pytest` run was using the machine, so they are a baseline within normal run-to-run noise rather than a clean pre-change measurement. Feature 005 measured `/book-appointment` as a holding page (169 kB JS); it is now the full booking page, so those two numbers are not comparable. The CPU-bound laptop caveat from Feature 004/005 still applies: compare later runs only on this machine and with this method.

## Phase 1 — setup and contract (T002–T008)

| Task | What changed |
|------|--------------|
| T002 | `argon2-cffi` 25.1.0 added to `backend/pyproject.toml` and `uv.lock` (`uv add argon2-cffi`; also pulls `argon2-cffi-bindings`, `cffi`, `pycparser`). |
| T003 | `backend/.env.example`: `SESSION_SECRET` (required, ≥ 32 chars, empty placeholder) and the nine optional tunables as commented defaults. No `.env` value was read or printed. |
| T004 | `specs/003-catalog-api/contracts/openapi.yaml` is now **1.2.0**: 19 operations under `/api/v1/admin/*` (tag `command-centre`), 3 security schemes, the `Reference` parameter, the admin responses and 32 schemas (incl. `Overview.recentBookings`). `ErrorInfo.code` gained the 13 Feature 006 codes and `ErrorInfo.retryAfterSeconds`. The delta's `RateLimited` response became `AdminRateLimited` (the name already existed); its global `security` became a per-operation `security`. Checked: no duplicate keys, all `$ref`s resolve, all 19 delta operations present, each has `security`. |
| T005 | `frontend/src/lib/api/schema.gen.ts` regenerated (`npm run api:types`). `api-contract-drift.test.ts` covers the admin paths: the operations exist in the committed types, and removed field, changed type, newly required field and removed operation are detected. `ErrorInfoSchema` (zod) was extended with the new codes and `retryAfterSeconds`, because the existing type-equality test requires it to equal the generated `ErrorInfo`. |
| T006 | `backend/tests/api/test_admin_contract.py`: one test per admin operation (route exists, same query parameters, documented statuses covered, same response properties), plus a check that the app serves no undocumented admin operation. All 19 operations are in `PENDING_ADMIN_OPERATIONS` and are **strict xfail**: they stay expected-red until their route exists, and a route that lands without its entry being removed fails the run. `tests/unit/test_openapi_contract.py` now skips `/api/v1/admin/*` (this module owns them). The backend `ErrorInfo` model gained optional `retry_after_seconds` (omitted from bodies when `None`) so the shared-schema property test stays equal. |
| T007 | `frontend/eslint.config.mjs`: `no-restricted-imports` for `@/admin` and `@/admin/**`, switched off for `src/admin/**`, `src/app/(admin)/**` and `tests/**`. Proved with a throwaway file: an import from `src/lib` is an error, the same import from `src/admin` is not (files removed). |
| T008 | `frontend/playwright.config.ts`: projects `admin-desktop` (1440×900), `admin-laptop-1366` (1366×768), `admin-laptop-1280` (1280×800), `admin-mobile` (Pixel 7), matching `admin-*.spec.ts` only. The three existing projects are unchanged; `admin-*.spec.ts` was added to the config-level `testIgnore` so they never run it. Proved with a throwaway spec: it ran in the four admin projects only; the suite list is unchanged at 1055 tests. |

## Checkpoint 1 (after T008)

| Command | Result |
|---------|--------|
| `uv run ruff check .` / `ruff format --check .` | pass |
| `uv run mypy` | pass, 101 source files |
| `uv run pytest -q` | **432 passed**, 1 skipped, 3 deselected, **19 xfailed** (baseline 430 passed). +2 passed are `test_admin_contract.py`'s two contract-level tests; the 19 xfails are the per-operation tests. |
| `npm run typecheck` / `npm run lint` | pass |
| `npm test` (Vitest) | **884 passed** (68 files; baseline 863): +21 admin drift tests |
| `npm run test:e2e` | **1044 passed**, 11 skipped (same as baseline), 6.1 min |
| Visual baselines | none regenerated, none changed (no snapshot file in `git status`) |

## Phase 2 — foundational (T009–T049)

| Group | Commits |
|-------|---------|
| Migration, models, settings, error codes | `8dfe159` (migration 0003 upgraded/downgraded on the dev database; 18 migration tests) |
| Auth core, sessions, throttle, policy table, `/admin/auth/me`, access log | `07f15e7` |
| Route groups: pure move (T028) | `77bbc8d` |
| Tokens split, admin root layout, BFF, isolation proofs, mock admin API | `ce02d55` |
| Shell, UI primitives, authenticated layout | `54b8434` |
| Clock, polling | `9b5e2c6` |

Deviations: `src/proxy.ts` (admin-only matcher) added for the 302 to sign-in and the `next` pathname; admin Inter uses its own font module (a shared one put Cormorant `@font-face` into every public page); light status line colours darkened to reach 3:1 (arrived #0d9488, no-show #a8812e, cancelled #d4655a); test cleanup TRUNCATE now includes `appointment_status_change`.

## Checkpoint 2

| Check | Result |
|-------|--------|
| `uv run ruff check .` / `mypy` | pass / pass (124 files) |
| Backend pytest (full) | 485 passed, 73 broke on a test-cleanup FK (fixed); the 47 affected tests re-run: all pass; 18 xfailed (later stories), 1 skipped |
| `npm test` (Vitest) | **1098 passed** (75 files; Phase 1: 884) |
| typecheck / lint | pass / pass |
| Playwright admin projects (4) | 223 passed, 132 skipped (viewport-specific), 1 test bug fixed and re-run green |
| Playwright main projects (mobile, iphone, desktop) | **1044 passed**, 11 skipped (= baseline) |
| `node scripts/check-admin-isolation.mjs` | OK: 18 public routes, 20 pages, 22 manifests clean |
| Visual baselines | none regenerated, none changed |
| Lighthouse, stateful/offline e2e | not run (not requested) |

Public route first-load JS (kB, uncompressed) vs Phase 1: `/contact` 906.4 (=), `/` 493.0 (=), `/book-appointment` 699.9 (699.7), `/doctors` 500.8 (500.5), `/health-tips` 498.5 (498.2), `/lab-tests` 484.6 (484.3), `/departments/[slug]` 482.2 (=), `/about` 479.1 (=), `/faq` 463.3 (=), `/_not-found` 460.8 (463.3). Four listing routes grew 0.2–0.3 kB (bundler regrouping; no public code changed).

## Phase 2 — final verification (clean re-run, same commit as Checkpoint 2 + cleanup fix)

| Check | Result |
|-------|--------|
| `uv run ruff check .` / `ruff format --check .` | pass / pass (129 files) |
| `uv run mypy` | pass, 124 source files, 0 errors |
| Backend pytest (full, single run) | **518 passed**, 1 skipped, 3 deselected, 18 xfailed (later stories), 0 failed, 0 errors; 605 s |
| `npm run typecheck` / `npm run lint` | pass / pass |
| `npm test` (Vitest) | **1098 passed** (75 files) |
| Playwright admin projects (4) | **224 passed**, 132 skipped (viewport-specific), 0 failed; 5.3 min |
| Playwright main projects (mobile, iphone, desktop) | **1044 passed**, 11 skipped (= baseline), 0 failed; 6.1 min |

The earlier pytest E/F marks (73 errors/failures) were all one cause: the committing-test cleanup `TRUNCATE` did not include `appointment_status_change`, so rows left by those tests broke the FK on later cleanup. Fixed in `642a1db` and `92c6136`; this full run has no E or F.

## Phase 3 — US2 sign-in and roles (T050–T067)

| Group | Commit |
|-------|--------|
| Common-password list: 30 591 entries (12–128 chars) bundled in `backend/app/auth/data/common-passwords.txt`, no runtime network | `48329d1`, `57dafc0` |
| Sign-in, sessions, password change, staff admin, `create_admin` CLI, backend tests (T050–T055, T058–T061) | `75a678b` |
| Session/password routes, login, password and Staff screens, SessionBoundary, mock API, unit + e2e tests (T056–T057, T062–T067) | see `git log` after `75a678b` |

**Password list.** The "top 10k" list has only 10 entries of 12+ characters, so it was not enough alone. The data file merges SecLists `10k-most-common`, `100k-most-used-passwords-NCSC`, `Pwdb_top-1000000` and `xato-net-10-million-passwords-100000` with the earlier hand-written list, keeps 12–128 characters, lower-cases, de-duplicates and sorts (provenance in `backend/app/auth/data/README.md`). Was ~200 entries.

**Deviations and decisions**
- Wrong *current* password on change-password answers `422 validation_error` (field `currentPassword`), not 401: a 401 would clear the cookie and sign the person out over a typo.
- The failure that triggers the lock already answers `429 account_locked` (so the 5th wrong password says "try again in 15 minutes"); unknown emails lock the same way.
- `end_demo_session` now expires a demo session one microsecond after creation at the earliest (the table requires `expires_at > created_at`; found by a test).
- Shared route helpers moved to `src/admin/lib/sessionRoute.ts` (`isSameOrigin`, cookie strings, `withoutToken`, JSON body reader); the catch-all route imports them.
- Submit buttons of the sign-in, password and add-staff forms are disabled until hydration (`useHydrated`), so an early submit cannot be a native GET carrying the password in the URL. This also removed a flaky e2e.
- `Dialog` body is a `div` (a form cannot sit inside a `p`).
- Staff table becomes stacked rows at ≤ 900 px (row actions overlapped on phones).
- Deferred to US1 as the tasks say: the demo button on the login page, and the "The demo has ended" variant of the session dialog. Demo viewers get an empty staff list and `demo_read_only` on writes.
- Last-admin e2e stubs the 409 (parallel projects share one mock server); the rule itself is proven by backend tests, including a deterministic lock test that fails when `FOR UPDATE` is removed.

## Checkpoint 3 (US2)

| Check | Result |
|-------|--------|
| `uv run ruff check .` / `ruff format --check .` / `mypy` | pass / pass / pass (70 source files) |
| Backend pytest (full) | **683 passed**, 1 skipped, 3 deselected, 11 xfailed (later stories), 0 failed; 17 min (Phase 2: 518 passed, 18 xfailed) |
| `test_sign_in` / `test_sessions` / `test_staff_admin` / `test_create_admin_cli` | 15 / 14 / 13 / 6 passed |
| `test_auth_matrix` | **104 passed** (SC-004 so far: 8 of the 19 table rows exist; each is run against 5 viewer kinds, 7 session states, proxy-secret/Origin and CSRF negatives; rows for later stories are generated as their routes land) |
| `npm run typecheck` / `npm run lint` | pass / pass (0 warnings) |
| `npm test` (Vitest) | **1166 passed** (80 files; Phase 2: 1098) |
| Playwright admin projects (4), full | **320 passed**, 132 skipped (viewport-specific), 0 failed |
| of which new: `admin-auth`, `admin-staff`, `admin-auth-a11y` (axe, both themes) | all green in all four projects |
| `node scripts/check-admin-isolation.mjs` | OK: 18 public routes, 62 prerendered pages, 22 manifests clean |
| Main Playwright projects | not run: no public page or layout changed |
| Visual baselines | none regenerated, none changed |
