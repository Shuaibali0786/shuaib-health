# PR-1 results: Phases 1-3 (before and after)

Date: 2026-10-10. "Before" = `baseline.md` (laptop, Windows, branch start). "After" = CI run `38043797290` on Linux (clean runs on fresh throwaway databases), plus one local Vitest run.

| Suite | Before (laptop) | After (CI, Linux) | Notes |
|---|---|---|---|
| Backend pytest | 1041 passed, 1 skipped, 1 failed (1043) | **1095 passed**, 0 failed, 0 skipped (4 perf tests deselected) | +52 new tests. The race test that failed on the laptop passes on CI. The skipped test needs `tzset`, which Windows lacks. |
| Vitest | 1373 passed | **1391 passed, 1 skipped** (CI) / **1392 passed** (laptop, 50% workers) | +18 new tests; the skip is platform-conditional |
| Playwright main | 1905 passed, 202 skipped | **1905 passed, 202 skipped** (3 shards: 691 + 689 + 525 passed; 12 + 13 + 177 skipped) | identical to before; Linux visual baselines are used |
| Playwright offline | 256 passed, 2 failed | **256 passed, 2 failed** | the same 2 assertions; **not caused by this feature, needs an owner decision** (below) |
| Playwright stateful | 1 passed, 24 failed (dev server could not resolve the Google font on the laptop) | **25 passed** | the laptop failures were local |
| Lighthouse CI (mobile, real API + demo data) | n/a | **passed** (Accessibility and Best Practices >= 0.90, budgets respected) | Performance is a warning only |
| ruff, ruff format, mypy | clean | clean | |
| eslint, tsc, `next build`, build with dead API | clean | clean | |
| pip-audit | n/a | **no known vulnerabilities** | |
| npm audit | 6 high | **0 outside the allow-list** (3 advisories allow-listed, dev-only) | |
| gitleaks (history, 119 commits) | n/a | **no leaks** | |

## Required checks on PR #8 right now

`backend` pass · `frontend` pass · `secrets` pass · `e2e` **fail** (only because of the offline assertions below).

## Needs the owner's decision (nothing was edited or loosened)

1. **T107, rate-limit test guard.** `test_rate_limit_api.py` passes in `memory` mode; in `postgres` mode 2 of 7 fail because of shared counters between tests (each passes alone). See `existing-test-guards.md` for options.
2. **Offline test `unset.spec.ts:25`** ("shows a neutral identity with no tel: links"): it expects the words "Shuaib Health" to appear nowhere on the neutral page, but the footer now shows "Powered by Shuaib Health" (added with the Booking Plus logo, PR #7). The two decisions conflict. Options: (a) the test ignores the "Powered by" platform credit (the test changes, a loosening only the owner can approve); (b) the credit is hidden when no clinic is configured (a product change); (c) leave as is and the required `e2e` check stays red. Recommended: (a).
3. **T116, Linux visual baselines**: look at the report `visual-linux-baselines.md` and approve.
4. **T034, npm audit allow-list** (`frontend/audit-allowlist.json`, 3 entries) and **the changes to existing tests/fixtures** listed in the PR description.

## Risk noticed (not fixed here)

`next build` fetches Google Fonts from `fonts.googleapis.com`. One CI run failed only because that fetch failed (the rerun passed). The same fetch happens in Vercel builds. A follow-up could self-host the fonts (`next/font/local`).
