---
id: 004
title: Launch ready cross-artifact analysis
stage: misc
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.analyze
labels: ["analysis", "constitution", "ci", "preview", "lighthouse"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - none modified (read-only analysis)
tests:
 - none
---

## Prompt

Owner approvals: (1) the 3 Safe-Change Playbook lines naming Vercel for the API — approved. (2) T011 change to backend/tests/api/test_retention.py — approved, as long as every assertion is kept and none is loosened.

Now run /sp.analyze for 007-launch-ready (spec, plan, tasks, constitution 1.2.0). Report only: any CRITICAL/HIGH issues, gaps, conflicts or untestable requirements, and propose fixes. Do not write code or deploy.

## Response snapshot

2 CRITICAL, 7 HIGH.
- CRITICAL: e2e may become a non-required CI check (FR-041/R10), against Constitution IX and the merge gate. New behaviours ship without OFF-by-default flags or a documented exception (XI).
- HIGH:
  - SC-002 requires SEO ≥ 90, but the demo is noindex (SEO previously 66–69).
  - Branch protection needs 1 approval, but the owner authors the PRs and GitHub blocks self-approval.
  - Preview environment broken: no migrations, no seed, the Neon preview branch copies prod data (playbook: staging uses fake data).
  - Vercel Deployment Protection blocks preview server-to-server calls.
  - Spec still holds Render-era FR-004/FR-034/FR-051, and C1–C4 aren't spec requirements.
  - No guard on the existing rate-limit tests when the limiter changes.
  - The fail-open global limiter isn't owner-approved.
FR coverage 54/54 (FR-004 N/A). Fixes proposed; none applied.

## Outcome

- ✅ Impact: blocking issues identified before /sp.implement
- 🧪 Tests: none
- 📁 Files: none modified
- 🔁 Next prompts: owner picks fixes → edit spec/plan/tasks → re-run /sp.analyze
- 🧠 Reflection: the self-approval and noindex-vs-SEO conflicts come from the environment (gh identity, memory note), not the documents alone

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): n/a
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
