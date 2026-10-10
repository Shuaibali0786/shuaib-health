---
id: 007
title: PR-1 foundations, CI and branch protection prep
stage: green
date: 2026-10-10
surface: agent
model: claude-sonnet-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.implement 007-launch-ready (Phases 1-3 only)
labels: ["launch-ready", "ci", "serverless", "fail-closed", "rate-limit", "vercel", "pr-1"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/8
files:
  - specs/007-launch-ready/results/ (baseline, gitleaks-history, ci-proof, phase-1-3-results, existing-test-guards, visual-linux-baselines, lighthouse/ci-budget-baseline, README)
  - docs/runbooks/README.md
  - backend/app/settings.py, db.py, main.py, asgi.py, logging_config.py
  - backend/app/booking/maintenance.py, backend/app/routers/maintenance.py
  - backend/app/middleware/rate_limit.py, access_log.py
  - backend/app/demo/generator.py (line-ending-proof catalog etag)
  - backend/scripts/vercel_build.py, backend/vercel.json, backend/pyproject.toml, backend/.env.example
  - backend/tests/ (feature flags, pool, production settings, maintenance, retention-cron, shared rate limit, openapi, xff, vercel build; conftest settings_factory)
  - frontend/src/lib/demo.ts, seo.ts, frontend/vercel.json, .env.example
  - frontend/tests/unit/ (demo-flag-production, site-url; guards.test.ts one-line allow)
  - frontend/tests/fixtures/admin/demo-day.json (one line: catalogEtag)
  - frontend/package.json, package-lock.json, audit-allowlist.json, scripts/check-audit.mjs, scripts/pixel-diff-report.mjs
  - frontend/lighthouserc.json, lighthouserc.budget.json, lighthouse-budget.json
  - frontend/tests/**/*-linux.png (139 new Linux visual baselines)
  - .github/workflows/ci.yml, update-linux-baselines.yml, .github/actions/, pull_request_template.md
tests:
  - backend pytest 1095 passed on CI (baseline 1041 passed + 1 skipped + 1 failed on laptop)
  - Vitest 1391 passed on CI, 1392 on laptop (baseline 1373)
  - Playwright main 1905 passed / 202 skipped (same as baseline); offline 256 passed / 2 failed (pre-existing); stateful 25 passed on CI
  - Lighthouse CI passed; pip-audit clean; npm audit clean outside the allow-list; gitleaks history clean
---

## Prompt

/sp.implement 007-launch-ready — Phases 1, 2 and 3 only (PR-1: setup, foundations, CI + branch protection). Branch: 007-launch-ready.
Rules: follow docs/SAFE-CHANGE-PLAYBOOK.md and the tasks exactly. Laptop has low RAM: run suites one at a time in the foreground with 2 Playwright workers and 50% Vitest workers.
At EVERY owner-action task (accounts, secrets, dashboards, branch protection): STOP and give me numbered, simple, click-by-click steps. Never create accounts, never print secrets, never deploy, never touch production.
When Phases 1–3 are done and green: write the PHR, push the branch, open the PR (do not merge), and show me the results plus the list of owner actions waiting for me.

## Response snapshot

Phase 1: ran every existing suite sequentially for the "before" baseline (found 3 pre-existing failure groups), created the evidence folder and runbook index, ran gitleaks over all history (clean).

Phase 2: serverless-safe backend. Infrastructure flags (OFF in code, explicit in production), CRON_SECRET, bounded DB pool, shared daily purge behind a Bearer-protected cron route (no startup task), PostgresFixedWindowLimiter for the general per-IP check (fails open, logs class only), /openapi.json hidden in production, fail-closed demo switches and site URL, xffHops count in the access log, Vercel config (sin1) with a guarded migrate-on-build script, env examples synced. Existing tests untouched; only add-only changes to the shared settings fixture and a one-line allow in the env-read guard (listed in the PR).

Phase 3: CI with four required checks (`e2e` is an aggregator over parallel parts under 20 min each), Lighthouse CI with measured budgets, gitleaks plus .gitignore check, npm audit with a reviewed allow-list, 139 Linux visual baselines generated in the Playwright container with a Windows-vs-Linux pixel-diff report, PR template, throwaway-PR proof.

Stopped, not edited: T107 (2 rate-limit assertions fail only in postgres mode, test isolation) and the offline "neutral identity" assertion that conflicts with "Powered by Shuaib Health". Owner actions T116, T038, T039 are waiting.

## Outcome

- ✅ Impact: PR-1 code, CI and evidence complete; `backend`, `frontend`, `secrets` green; `e2e` red only on a pre-existing assertion pair that needs an owner decision.
- 🧪 Tests: see the list above; CI run 38043797290.
- 📁 Files: see the list above.
- 🔁 Next prompts: owner decisions (T107, offline assertion, T116), branch protection (T038), merge (T039); then Phase 4 (rate-limit trust) in PR-2.
- 🧠 Reflection: laptop-only baselines hid two Windows-specific assumptions (line-ending etag, Windows-only visual baselines); CI on Linux exposed both. The shell tool dropped backslashes from commands, so regexes were written with the file editor.

## Evaluation notes (flywheel)

- Failure modes observed: Windows-generated lockfile broke `npm ci` on Linux; env vars set job-wide hid "missing setting" tests; bare-runner fonts differ from the Playwright container; Google Fonts fetch is a build-time network dependency.
- Graders run and results (PASS/FAIL): backend PASS, frontend PASS, secrets PASS, e2e FAIL (pre-existing offline assertions).
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): self-host the fonts so builds do not depend on fonts.googleapis.com.
