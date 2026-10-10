---
id: 006
title: K3 fix final analysis and commit
stage: misc
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: K3 playbook note + plan fixes + /sp.analyze final + commit
labels: ["analysis", "playbook", "ci", "lighthouse", "visual-baselines", "neon"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - docs/SAFE-CHANGE-PLAYBOOK.md
 - .specify/memory/constitution.md
 - specs/007-launch-ready/plan.md
 - specs/007-launch-ready/tasks.md
 - specs/007-launch-ready/quickstart.md
 - specs/007-launch-ready/contracts/ci-checks.md
 - specs/007-launch-ready/contracts/required-settings.md
tests:
 - none
---

## Prompt

K3: option (a). Add the note to playbook rule 7 for infrastructure flags on Vercel: switch off by changing the value and redeploying (~1–2 min), or use Instant Rollback to an earlier deployment where the flag was off. Product feature flags in later features keep the "no redeploy" promise. Update the constitution sync note if needed.
Also fix the 3 plan.md phrases (lines 62, 123, 163) so they say migrations run in production AND preview.
Then re-run /sp.analyze and confirm 0 CRITICAL, 0 HIGH, 0 MEDIUM. Commit the 007 planning docs on branch 007-launch-ready (no push yet). Do not write code or deploy.

## Response snapshot

- K3: playbook rule 7 note added; the constitution 1.2.0 sync report lists the rule 6 and 7 notes (no version bump: no principle text changed).
- The three plan.md migration phrases fixed.
- A clause-by-clause final pass found four more gaps. Each was fixed by putting existing constitution or playbook text into tasks:
  - K4: CI `.gitignore` check (Constitution VI) → T113;
  - K5: Lighthouse CI budgets (Constitution VIII) → T114;
  - H8: Neon preview branch inherits role credentials → password reset on the preview branch in T055;
  - H9: all 139 visual baselines are win32-only, so the required Linux e2e would fail → T115 + owner approval T116 (rule 5).
  e2e Playwright configs run sequentially on their own DB container (rule 3).
- Final: 0 CRITICAL / 0 HIGH / 0 MEDIUM; 116 tasks, 33 owner actions, FR coverage 58/58. Committed locally, not pushed.

## Outcome

- ✅ Impact: 007 planning artifacts consistent and committed on 007-launch-ready
- 🧪 Tests: none
- 📁 Files: listed above plus all 007 planning docs in the commit
- 🔁 Next prompts: /sp.implement Phase 1–3 (PR-1)
- 🧠 Reflection: the earlier passes missed constitution "Test:" lines and platform-specific baselines; checking every Test line and every playbook clause caught them

## Evaluation notes (flywheel)

- Failure modes observed: incomplete earlier analysis passes (corrected and reported to the owner)
- Graders run and results (PASS/FAIL): 0/0/0 target PASS after fixes
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): run the constitution "Test:" line checklist in the first analysis pass
