---
id: 008
title: PR-2 rate-limit trust, security headers, Sentry, fonts
stage: green
date: 2026-10-10
surface: agent
model: claude-sonnet-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.implement 007-launch-ready (PR-2: Phases 4-7 code and docs, plus self-hosted fonts)
labels: ["launch-ready", "rate-limit", "security-headers", "sentry", "target-guard", "backups", "fonts", "pr-2"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011
  pr: null
files:
  - backend/app/middleware/rate_limit.py, backend/app/main.py (trusted server exemption)
  - backend/app/ops/target_guard.py, backend/app/seed/__main__.py, backend/app/auth/create_admin.py
  - backend/app/observability.py, backend/app/errors.py, backend/app/settings.py, backend/app/routers/maintenance.py
  - backend/scripts/measure_latency.py, backend/pyproject.toml, backend/uv.lock
  - backend/tests/api/test_rate_limit_trust.py, test_maintenance_purge.py (sentry-check tests)
  - backend/tests/unit/test_target_guard.py, test_sentry_scrub.py, test_measure_latency.py
  - frontend/next.config.ts, src/lib/security-headers.ts, src/lib/api/http.ts, src/lib/api/config.ts, src/lib/booking/backend.ts, src/admin/lib/server.ts
  - frontend/sentry.server.config.ts, src/instrumentation.ts, src/lib/sentry-scrub.ts, package.json
  - frontend/src/fonts/*.woff2, the three layouts (next/font/local)
  - frontend/tests/unit (client-ip, catalog-http-secret, protection-bypass, security-headers, sentry-scrub, no-google-fonts), tests/e2e (security-headers, no-localhost)
  - frontend visual baselines (public site, win32)
  - docs/runbooks (first-deploy, smoke-test, backup-workflow.yml.example, restore-drill, migration-restore-point)
  - specs/007-launch-ready/results (copy-audit, fonts-pixel-diff), tasks.md
tests:
  - backend: ruff, format, mypy clean; pytest 1129 passed, 1 skipped (laptop)
  - frontend: eslint and tsc clean; Vitest all pass after adapting two font tests; new e2e specs pass on desktop
  - admin-visual passes unchanged; full Playwright suite not run on the laptop (memory), CI is the gate
---

## Prompt

/sp.implement 007-launch-ready — PR-2: Phases 4, 5, 6 and 7 (rate-limit trust, live demo, alerts and Sentry, backups). First check that the CI run on main after PR #8 is green; if it is not, stop and tell me. Work on 007-launch-ready, updated from main.
Also add one small task: self-host the Google Fonts (next/font local files) so builds never depend on downloading Google Fonts. Keep the look identical, and give a pixel-diff if baselines change.
Rules: follow docs/SAFE-CHANGE-PLAYBOOK.md and the tasks exactly. Low RAM: run suites one at a time in the foreground, 2 Playwright workers, 50% Vitest.
At EVERY owner-action task (Vercel, Neon production, Sentry, UptimeRobot, secrets, first deploy, phone check): STOP and give me numbered, very simple, click-by-click steps, one task at a time. Never create accounts yourself, never print secrets, never touch production without my go-ahead.
When PR-2 is green: write the PHR, push, open the PR (do not merge), and show me the results.

Follow-ups in the same session:
- "Decision: fix it in its own small PR first, so main goes green now." (CI Lighthouse cleanup fix, PR #11, merged with a merge commit.)
- "Decision: stop running the heavy suites on my laptop. CI is our real gate now. Commit the PR-2 work so far with a PHR, push 007-launch-ready, and open PR-2 as a DRAFT (do not merge). Let CI run every suite on Linux. If the only visual differences are the expected announcement-bar font changes: regenerate the Linux baselines through the CI update workflow, then make me side-by-side review images in D:\shuaib-health-review\fonts\ for the 3 biggest diffs. If any other test fails, fix it and push again. When all 4 checks are green, stop and give me the first owner-action task as numbered, very simple, click-by-click steps."

## Response snapshot

CI on main was red after PR #8 (the Lighthouse job's post-step uv cache prune hung on the still-running backend). Fixed in PR #11 (stop the backend with an always() step, prune-cache false); main went green.

Phase 4: trusted-server exemption in the rate limiter behind TRUSTED_SERVER_EXEMPT; catalog fetches send the proxy secret (visitor IP is opt-in so cached pages stay static); IP header order x-vercel-forwarded-for, x-real-ip, x-forwarded-for; tests; existing rate-limit tests pass unchanged in both modes (T108).
Phase 5 code: security headers behind SITE_SECURITY_HEADERS (build fails on Vercel when unset), e2e specs, copy audit (nothing removed), target guard on seed and create_admin, preview protection-bypass header, latency script, first-deploy and smoke-test runbooks.
Phase 6 code: Sentry for API and website with scrubbers, flush before the 500 response, sentry-check route, tests.
Phase 7 docs: backup workflow template, restore drill, restore point.
Fonts: three byte-identical woff2 files self-hosted via next/font/local; only the announcement bar differs (359-580 px per image on the 62 Windows baselines).

## Outcome

- ✅ Impact: PR-2 code and docs complete; owner-action tasks (T054 onward) still waiting.
- 🧪 Tests: laptop results above; Linux CI is the gate (full Playwright run was killed for low memory).
- 📁 Files: see list above.
- 🔁 Next prompts: CI green and Linux baseline regeneration; owner approval T054; Neon/Vercel launch steps.
- 🧠 Reflection: next/font options must be literal (no shared constant); SDK 11 of @sentry/nextjs replaced sendDefaultPii with dataCollection; the shell tool drops backslashes, so edits with regexes go through files.

## Evaluation notes (flywheel)

- Failure modes observed: a laptop full-suite run hit the memory reaper; a unicode-range experiment did not change the pixel difference; two existing tests were bound to the Google font implementation.
- Graders run and results (PASS/FAIL): backend PASS, frontend unit PASS, admin-visual PASS, full e2e not run locally.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): find why only the announcement bar renders differently with local fonts.
