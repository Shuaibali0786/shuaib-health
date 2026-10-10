---
id: 005
title: Apply analysis fixes and reanalyze
stage: misc
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: apply K1/K2/H1–H7 fixes + /sp.analyze re-run
labels: ["analysis", "feature-flags", "ci", "preview", "playbook"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - specs/007-launch-ready/spec.md
 - specs/007-launch-ready/plan.md
 - specs/007-launch-ready/research.md
 - specs/007-launch-ready/tasks.md
 - specs/007-launch-ready/data-model.md
 - specs/007-launch-ready/quickstart.md
 - specs/007-launch-ready/contracts/ci-checks.md
 - specs/007-launch-ready/contracts/required-settings.md
 - specs/007-launch-ready/contracts/ops-endpoints.md
 - history/adr/0011-launch-hosting-and-deploy-strategy.md
 - docs/SAFE-CHANGE-PLAYBOOK.md
tests:
 - none
---

## Prompt

Owner decisions:
1. K2: option (a), feature flags that are OFF in code and switched ON explicitly in production, as you listed. Endpoints with secrets stay off when the secret is unset.
2. H2: 0 required approvals. Keep the 4 required checks, no force-push, no admin bypass. My merge click is the approval (playbook rule 6). Record this in the spec and the playbook note.
3. H7: approved as you recommended. Only the general per-IP check fails open on a DB failure. Booking, login and demo limits keep blocking. Record it in ADR-0011 under C2.

Apply your proposed fixes for all 9 issues (K1, K2, H1–H7) to the spec, plan, tasks and contracts, then re-run /sp.analyze. Show me the final counts and confirm 0 CRITICAL and 0 HIGH remain. Do not write code or deploy.

## Response snapshot

All 9 fixes applied:
- spec: FR-004 N/A, FR-005, FR-034, FR-041, FR-042, FR-051, FR-067, SC-002, SC-004; new FR-076–079; clarifications.
- plan: flags table, preview environment, merge gate, Lighthouse.
- research: R3, R8, R10.
- ADR-0011: C2 failure mode, flags, previews.
- contracts, data-model, quickstart updated; playbook rule 6 note added.
- tasks: T105–T112 added (stable IDs), and existing tasks edited.
Re-analysis: 1 CRITICAL remains. Playbook rule 7 says a flag switch needs "no redeploy", but Vercel env-var flags need a redeploy (Constitution XI incorporates the playbook); missed in the first pass. Also 1 MEDIUM: three stale "production-only migration" phrases in plan.md. Tasks 112, owner actions 32, FR coverage 58/58.

## Outcome

- ✅ Impact: 9 of 9 original findings resolved; 1 newly found CRITICAL needs an owner decision
- 🧪 Tests: none
- 📁 Files: listed above
- 🔁 Next prompts: owner decides on playbook rule 7 vs Edge Config → fix → re-run /sp.analyze
- 🧠 Reflection: the first analysis pass missed the redeploy clause in playbook rule 7

## Evaluation notes (flywheel)

- Failure modes observed: an incomplete first-pass check of the playbook's sub-clauses
- Graders run and results (PASS/FAIL): 0 CRITICAL / 0 HIGH target — FAIL (1 CRITICAL)
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): check every playbook rule clause-by-clause in analysis passes
