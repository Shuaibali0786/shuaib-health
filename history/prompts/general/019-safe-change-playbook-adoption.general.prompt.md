---
id: 019
title: Safe change playbook adoption
stage: general
date: 2026-10-08
surface: agent
model: claude-sonnet-5-5
feature: none
branch: chore/safe-change-playbook
user: Shuaibali0786
command: (overnight run) Task 1 - chore/safe-change-playbook
labels: ["playbook","constitution","process","pr-template"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - docs/SAFE-CHANGE-PLAYBOOK.md
 - .specify/memory/constitution.md
 - CLAUDE.md
 - .github/pull_request_template.md
 - history/prompts/006-clinic-command-centre/018-demo-coherence-slip-watermark-reference-alphabet.green.prompt.md
tests:
 - none (documentation and process files only)
---

## Prompt

Overnight run, Task 1: branch chore/safe-change-playbook. Commit the untracked docs/SAFE-CHANGE-PLAYBOOK.md;
add a "Safe Change" principle to the constitution referencing the playbook, bump the version and add a sync
impact note; add a one-line rule to CLAUDE.md; add .github/pull_request_template.md with the playbook
section 7 checklist; set PHR 018's pr field to https://github.com/Shuaibali0786/shuaib-health/pull/4; write a
PHR; commit, push, open a PR, do not merge. (Hard rules: never commit to main, never merge, never deploy,
never touch production, never print secrets.)

## Response snapshot

Created the branch from up-to-date main. Added constitution principle XI "Safe Change" (version 1.0.1 → 1.1.0,
MINOR), with a Sync Impact Report flagging plan-template.md as a follow-up. Added the CLAUDE.md rule, the PR
template (playbook §7 checklist), and filled PHR 018's pr link.

## Outcome

- ✅ Impact: playbook is now part of the constitution, agent rules and PR flow.
- 🧪 Tests: none run (docs only).
- 📁 Files: see front matter.
- 🔁 Next prompts: add a Safe Change gate to .specify/templates/plan-template.md.
- 🧠 Reflection: plan-template gate deliberately left out to keep the diff to the requested scope.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): n/a
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): wire the playbook checklist into CI
