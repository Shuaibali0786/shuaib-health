---
id: 001
title: Launch ready deployment spec
stage: spec
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.specify
labels: ["deployment", "ci", "monitoring", "backups", "security", "free-tier"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/007-launch-ready/spec.md
 - specs/007-launch-ready/checklists/requirements.md
 - history/prompts/007-launch-ready/001-launch-ready-deployment-spec.spec.prompt.md
tests:
 - none (spec stage; read-only npm audit run to confirm 6 high findings)
---

## Prompt

/sp.specify 007-launch-ready: take Shuaib Health from laptop to a live, monitored, safe public demo — the first real deployment. Follow docs/SAFE-CHANGE-PLAYBOOK.md and the constitution.

Input: read D:\shuaib-health-reports\deploy-readiness-2026-10-09.md — all 5 blockers and 8 important findings must be covered; nice-to-haves listed as optional.

Scope:
- Hosting: Vercel (frontend, region sin1) + Render (FastAPI, Singapore) + Neon (Postgres, Singapore) — same region. FREE tiers only (founder money rule); note any free-tier limit that could bite (Vercel Hobby terms, Render sleep, Neon compute hours/autosuspend) and how we stay inside it.
- Deploy config in repo (render.yaml, vercel config if needed), Alembic migrations run safely on deploy, one-off first seed + first admin via CLI, never on our dev DB by mistake.
- Production defaults: DEMO_ENABLED on for our public demo, indexable off, SITE_URL correct, no localhost anywhere.
- Rate limiting + real client IP correct behind Vercel/Render proxies.
- CI: GitHub Actions on every PR (lint, types, unit tests, build; e2e as budget allows), required before merge.
- Monitoring: UptimeRobot alerts to owner, keep-alive within free limits, error tracking (free tier), health/ready endpoints.
- Backups + a tested restore drill.
- Security: fix the 6 high npm audit findings, secrets only in host dashboards, gitleaks, security headers.
- Speed promise: Lighthouse mobile ≥ 90 on live, API p95 < 1s, phone QA on a real device, smoke test checklist, one-click rollback documented.
- Runbook docs: deploy, rollback, incident note, new-env-var checklist.

Out of scope: real clinic clients, paid plans, custom domain purchase (prepare for it only), new product features.

Stop after the spec is written and show me a short summary + any open questions. Do not write code, do not create accounts, do not deploy.

## Response snapshot

Created branch 007-launch-ready and specs/007-launch-ready/spec.md: 7 prioritized user stories (live demo works; CI gate; alerts + error tracking; fair rate limiting; migrate/seed/backup/restore; rollback + runbooks; free-tier fit), FR-001–FR-073 grouped A–J, a free-tier limits table, a traceability table mapping all audit items B1–B5, I1–I8, N1–N6 (N1, N3 included as optional; N2 a non-goal), 12 measurable success criteria, and two open questions (backup storage location; Vercel Hobby non-commercial terms). Confirmed via read-only checks: repo is public, main is unprotected, npm audit shows 6 highs (braces chain via eslint-config-next + source-map-js; npm's only fix for the chain is a forced downgrade, which the playbook forbids). Quality checklist passes.

## Outcome

- ✅ Impact: Phase 4 (Deploy) spec ready for /sp.clarify or /sp.plan
- 🧪 Tests: none (spec stage)
- 📁 Files: spec.md, checklists/requirements.md, this PHR
- 🔁 Next prompts: answer Q1/Q2, then /sp.plan
- 🧠 Reflection: free-tier figures must be verified in dashboards during plan; Render's 750 h/month budget only fits one always-warm service

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 raised a parameter-binding error after creating the branch and spec file; outputs were correct
- Graders run and results (PASS/FAIL): spec quality checklist PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
