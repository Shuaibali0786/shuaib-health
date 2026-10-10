# PR-1 results: Phases 1-3 (before and after)

Date: 2026-10-10. "Before" = `baseline.md` (laptop, Windows, branch start). "After" = CI run `38045924723` on Linux, after the owner decisions (clean runs on fresh throwaway databases), plus one local Vitest run.

| Suite | Before (laptop) | After (CI, Linux) | Notes |
|---|---|---|---|
| Backend pytest | 1041 passed, 1 skipped, 1 failed (1043) | **1095 passed**, 0 failed, 0 skipped (4 perf tests deselected); plus `test_rate_limit_api.py` again with `RATE_LIMIT_STORE=postgres`: **7 passed** | +52 new tests. The race test that failed on the laptop passes on CI. The skipped test needs `tzset`, which Windows lacks. |
| Vitest | 1373 passed | **1391 passed, 1 skipped** (CI) / **1392 passed** (laptop, 50% workers) | +18 new tests; the skip is platform-conditional |
| Playwright main | 1905 passed, 202 skipped | **1905 passed, 202 skipped** (3 shards: 691 + 689 + 524 passed, +1 flaky that passed on its retry; 12 + 13 + 177 skipped) | same totals as before; Linux visual baselines are used |
| Playwright offline | 256 passed, 2 failed | **258 passed** | the 2 old failures now pass with the owner-approved strict exception for the platform credit; 256 + 2 = 258 |
| Playwright stateful | 1 passed, 24 failed (dev server could not resolve the Google font on the laptop) | **25 passed** | the laptop failures were local |
| Lighthouse CI (mobile, real API + demo data) | n/a | **passed** (Accessibility and Best Practices >= 0.90, budgets respected) | Performance is a warning only |
| ruff, ruff format, mypy | clean | clean | |
| eslint, tsc, `next build`, build with dead API | clean | clean | |
| pip-audit | n/a | **no known vulnerabilities** | |
| npm audit | 6 high | **0 outside the allow-list** (3 advisories allow-listed, dev-only) | |
| gitleaks (history, 119 commits) | n/a | **no leaks** | |

## Required checks on PR #8 (run 38045924723)

`backend` pass · `frontend` pass · `secrets` pass · `e2e` pass (all four parts: lighthouse, main x3 shards, offline, stateful).

**One flaky test, reported honestly:** `tests/e2e/admin-shell.spec.ts:79` ("the navy side column reaches the bottom of the window...", project admin-laptop-1280) failed once and passed on CI's single automatic retry. It passed first time in the two earlier runs of the same shards. It is a layout-timing test, nothing in this PR touches that code, and it is not quarantined. If it flakes again it should be fixed in the spec (needs the owner's approval to change an existing test).

## Owner decisions (all settled on 2026-10-10)

1. **T107, rate-limit guard:** approved an add-only fixture; `test_rate_limit_api.py` unchanged, passes 7/7 in both modes (see `existing-test-guards.md`).
2. **Offline assertion `unset.spec.ts:25`:** kept strict. Only the platform credit element (`data-testid="powered-by"`) is excluded; "Shuaib Health" anywhere else on the neutral page still fails (proved on sample pages: credit alone 0 matches, the name in a heading or paragraph 1 match). The credit is not hidden, and the test now also checks that the credit reads "Powered by Shuaib Health".
3. **npm audit allow-list:** approved for the 3 dev-only advisories, each with a reason and a review date of 2026-11-09.

Still waiting on the owner: **T116** (approve the Linux visual baselines), **T038** (branch protection), **T039** (merge click).

## Risk noticed (not fixed here)

`next build` fetches Google Fonts from `fonts.googleapis.com`. One CI run failed only because that fetch failed (the rerun passed). The same fetch happens in Vercel builds. A follow-up could self-host the fonts (`next/font/local`).
