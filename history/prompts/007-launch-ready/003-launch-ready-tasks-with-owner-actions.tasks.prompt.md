---
id: 003
title: Launch ready tasks with owner actions
stage: tasks
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.tasks (after ADR approval, constitution amendment, CLAUDE.md fix)
labels: ["tasks", "deployment", "owner-actions", "serverless", "adr-conditions"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - specs/007-launch-ready/tasks.md
 - specs/007-launch-ready/plan.md
 - specs/007-launch-ready/contracts/ops-endpoints.md
 - specs/007-launch-ready/contracts/required-settings.md
 - history/adr/0011-launch-hosting-and-deploy-strategy.md
 - .specify/memory/constitution.md
 - docs/SAFE-CHANGE-PLAYBOOK.md
 - CLAUDE.md
tests:
 - none (tasks stage)
---

## Prompt

Decisions (owner):
1. ADR-0011 approved: FastAPI on Vercel (sin1), with these conditions written into the plan:
   - Neon POOLED connection string, with small pool settings safe for serverless.
   - Rate limiting and lockout must use shared state (DB or Vercel KV/Edge Config), not in-process memory.
   - No background threads or long-running tasks inside functions. Check every place that currently relies on them.
   - Measure Python cold start on a preview deploy and record it against the speed promise.
2. Backups: private GitHub repo, auto-deleted after 14 days, plus my manual monthly copy to Drive. Approved.
3. If a free allowance runs out, the demo pauses until month-end. Never enable billing. Approved.

Then:
a) /sp.constitution: small amendment to the tech-stack section (backend host becomes Vercel functions; Render stays only for legacy/other projects). Bump the version and add a sync impact note.
b) Fix CLAUDE.md by hand so the agent context reflects 007 (the script left it unchanged).
c) /sp.tasks for 007, grouped by phase and user story, with a clear "owner action" marker on every step that needs me (creating accounts, adding secrets in dashboards, approving merges).
Do NOT write code, create accounts or deploy. Stop and show me a short summary: number of tasks per phase, and the list of owner actions.

## Response snapshot

Conditions C1–C4 were audited against the code and written into plan.md and ADR-0011, which is now Accepted.
- C1: db.py pool 5+5 → configurable 1+1.
- C2: only the global per-IP middleware was in-memory; lockout, login, booking and demo limits were already in Postgres. A Postgres limiter replaces it; KV and Edge Config rejected.
- C3: the lifespan startup purge ran in a background thread. It is replaced by a daily Vercel Cron calling a CRON_SECRET endpoint, and Sentry flushes before the response.
- C4: cold-start gate T059 on a preview deploy.
Constitution 1.1.0 → 1.2.0; playbook rollback lines updated; CLAUDE.md got Active Technologies and Recent Changes sections.
tasks.md: 104 tasks in 10 phases, 30 owner-action tasks, 3 PR slices.

## Outcome

- ✅ Impact: 007 ready for /sp.implement starting with Phase 1–3 (PR-1)
- 🧪 Tests: none run (tasks stage)
- 📁 Files: listed above
- 🔁 Next prompts: /sp.implement Phase 1–3
- 🧠 Reflection: the code audit found the startup background thread and the 5+5 pool, both of which would have misbehaved on serverless

## Evaluation notes (flywheel)

- Failure modes observed: python not on PATH (used Edit tool); the agent-context script didn't update CLAUDE.md because the file lacks its section markers
- Graders run and results (PASS/FAIL): task format check (checkbox, ID, story label, path) PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
