# Baseline — "before" counts (T001)

Date: 2026-10-10 · Branch `007-launch-ready` at `3e6d6e9` (clean tree) · Windows laptop, suites run one at a time.
Backend tests ran against the remote Neon **test** database (very slow: about 2 h for the first 645 tests).

| Suite | Command | Result |
|---|---|---|
| Backend pytest | `uv run pytest` (1043 selected, 4 perf deselected) | **1041 passed, 1 skipped, 1 failed** |
| Frontend Vitest | `vitest run --maxWorkers=50%` | **1373 passed** (102 files) |
| Playwright main | `playwright test --workers=2` | **1905 passed, 202 skipped**, 0 failed |
| Playwright offline | `-c playwright.offline.config.ts --workers=2` | **256 passed, 2 failed** |
| Playwright stateful | `-c playwright.stateful.config.ts` (workers 1) | **1 passed, 24 failed** |

The backend run was done in three parts because the first stopped at its first failure (`-x`): 644 passed, then the single failure, then the remaining 398 tests (332 passed + 1 skipped, and 65 passed).

## Failures that already exist on the clean branch (not caused by this feature)

These are recorded, **not fixed and not loosened** (Constitution XI). Each needs the owner's decision.

1. **Backend** `tests/api/test_staff_admin.py::test_two_concurrent_demotions_leave_exactly_one_admin` — expects responses `{200, 409}`, gets `{200, 403}`. Failed twice (inside the suite and alone). Looks like a race: the second request is made by an admin who has just been demoted, so it gets 403 instead of 409.
2. **Playwright offline** `unset.spec.ts:25` "shows a neutral identity with no tel: links" (desktop and mobile) — `getByText("Shuaib Health")` finds 1 element where the test expects 0. Failed twice. Likely from the recent brand-logo change.
3. **Playwright stateful** — 24 failed, 1 passed. The dev server (Next 16.4 Turbopack) logs `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` for `next/font/google`, so pages in dev mode fail. Failed in both runs.
   Skipped in the main suite: 202 (project-scoped specs, as designed).

Other notes: 1 skipped backend test needs `time.tzset`, which Windows lacks.
