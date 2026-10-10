---
id: 003
title: Backend host Vercel Functions
stage: constitution
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.constitution
labels: ["constitution", "hosting", "vercel", "amendment"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - .specify/memory/constitution.md
 - docs/SAFE-CHANGE-PLAYBOOK.md
tests:
 - none
---

## Prompt

Small amendment to the Technology Stack & Deployment Constraints section: backend host becomes Vercel Functions (Python, region sin1); Render stays only for legacy/other projects. Also update Principle X Phase 4 wording "(Vercel + Render)". Bump version (MINOR) and add a Sync Impact Report. Approved by owner 2026-10-09 per ADR-0011.

## Response snapshot

Constitution 1.1.0 → 1.2.0. Changes:
- Tech Stack: backend on Vercel Functions (Python, sin1, separate project), with stateless rules (no background threads or long tasks; shared state in Postgres; cron + authenticated endpoint). Render kept only for legacy and other projects.
- Phase 4 wording updated.
- Sync Impact Report prepended; the previous report kept.
- Playbook rollback and checklist lines updated from Render to the Vercel API project.

## Outcome

- ✅ Impact: constitution aligned with ADR-0011; the plan's deviation is resolved
- 🧪 Tests: none
- 📁 Files: constitution.md, SAFE-CHANGE-PLAYBOOK.md
- 🔁 Next prompts: /sp.tasks 007
- 🧠 Reflection: MINOR because deployment guidance changed materially without removing a principle

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): version line matches report; ISO dates; no bracket tokens — PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
