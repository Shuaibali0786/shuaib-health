---
id: 017
title: Phase 10 completion: Lighthouse, SEO and T148-T157
stage: green
date: 2026-10-08
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: (direct request) finish Phase 10 before the PR
labels: ["lighthouse","seo","retention","log-safety","resilience","security-review","clean-checkout"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - backend/app/booking/retention.py
 - backend/app/main.py
 - backend/tests/api/test_log_safety.py
 - backend/tests/api/test_retention.py
 - backend/tests/api/test_auth_matrix.py
 - backend/README.md
 - frontend/src/admin/bookings/copy.ts
 - frontend/src/admin/bookings/BookingsScreen.tsx
 - frontend/src/admin/overview/useStatusFlow.ts
 - frontend/src/admin/auth/copy.ts
 - frontend/tests/unit/seo-indexing.test.ts
 - frontend/tests/unit/status-actions.test.tsx
 - frontend/tests/e2e/seo.spec.ts
 - frontend/tests/e2e/admin-honesty.spec.ts
 - frontend/tests/e2e/stateful/admin-resilience.spec.ts
 - frontend/tests/e2e/mock-api.ts
 - frontend/tests/e2e/offline.spec.ts
 - frontend/tests/e2e/motion.spec.ts
 - frontend/README.md
 - specs/006-clinic-command-centre/quickstart.md
 - specs/006-clinic-command-centre/results.md
 - specs/006-clinic-command-centre/tasks.md
tests:
 - backend pytest full (clean clone) 1030 passed, 1 skipped
 - backend perf test_command_centre_latency (passed when run alone; first run failed on remote-DB noise)
 - vitest 1359 passed, 1 skipped
 - playwright main 1903 passed, 2 failed (pre-existing hydration race, fixed; 65/65 on repeat)
 - playwright stateful 25 passed; offline config 258 passed
 - test_auth_matrix 243 cases; BFF matrix 76
---

## Prompt

Feature 006 (branch 006-clinic-command-centre). Before any PR, finish Phase 10 properly:
1. Lighthouse regression: on this same laptop, Feature 005 measured Home ~85 and Book ~86-87 (see specs/005-appointment-booking/results.md). Now Home 40, Book 54, admin ~40. Measure correctly: production build (next build + next start), nothing else running (no tests, no dev servers), median of 3. If still low, find the cause (compare with the 005 merge commit 55e3143: JS size, fonts, the gold top bar, render-blocking, hydration) and fix it. Target: back to the 005 level or better.
2. SEO 66-69: check whether the admin "noindex"/no-store headers leak onto public pages, plus robots.txt, meta descriptions, canonical, sitemap. Public pages must be indexable; admin must stay noindex. Fix and add a test.
3. Complete the unticked tasks T148-T157 (log safety, retention, honesty, offline, auth-matrix count, SC timings, READMEs, run /security-review, clean-checkout run, Overview <= 120 KB gzip).
4. Do NOT upgrade Next.js in this branch; just note it.
Rules: full suites sequential, single clean runs; ruff/mypy/tsc/lint clean; never print secrets; dev DB only; npm.cmd/npx.cmd; no lingering loops; stop if a step hangs >15 min. Commit + push. STOP before PR with a short report: Lighthouse before/after, SEO cause + fix, tasks done, test table.

Follow-up (user): Keep noindex for the DEMO clinic (it is fictional and must not appear in Google search — honesty rule). The per-clinic `indexable` flag stays the single source of truth, so real client clinics will be indexable when we onboard them. Now verify: do one production build with indexable=true (test only, don't change the seed) and run Lighthouse SEO; it must reach ~100 — fix any other SEO issue you find (meta descriptions, canonical, sitemap, robots, link text). Document this in results.md, then continue with the Lighthouse speed investigation and the remaining tasks.

## Response snapshot

- Lighthouse: HEAD and 55e3143 built side by side, measured alternately on an idle machine: Home 82 = 82, Book 85 = 85, /admin 78; same JS. The 40/54 came from CPU contention while measuring (TBT pattern matches the T001 baseline taken during pytest). No code change needed.
- SEO: no admin header leaks; 66-69 is is-crawlable from the demo clinic's indexable=false (by design, same as 005). Test-only indexable build: SEO 100 on 16 pages, canonical/description/robots correct, admin still noindex. Tests added (unit + e2e).
- T148-T156 done; T151 found and fixed a stale status after a timed-out change (re-read, never resent). T157 clean-checkout run done; SC-002 viewer review needs people, so T157 stays open.
- SC-001: desktop 0.37 s met; throttled mobile 3.6-4.5 s not met on this laptop (CPU-bound; streaming experiment gave no gain). SC-003 1.6-2.1 s.

## Outcome

- ✅ Impact: Phase 10 evidenced in results.md; one real bug fixed; SEO and honesty guarded by tests.
- 🧪 Tests: see the clean-checkout table in results.md.
- 📁 Files: see list above.
- 🔁 Next prompts: SC-002 informal review; decide on the throttled-mobile SC-001 miss; Next.js 16.4 upgrade in its own branch; open the PR.
- 🧠 Reflection: measure Lighthouse side by side against the baseline commit before hunting a regression.

## Evaluation notes (flywheel)

- Failure modes observed: an earlier Lighthouse run under CPU load was reported as a regression; a ruff error slipped in after the last lint run and was caught by the clean checkout.
- Graders run and results (PASS/FAIL): ruff PASS (after fix), mypy PASS, tsc PASS, eslint PASS, pytest PASS, vitest PASS, playwright PASS after a test-only flake fix, gitleaks PASS.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): measure SC-001 on a real mid-range phone before optimising.
