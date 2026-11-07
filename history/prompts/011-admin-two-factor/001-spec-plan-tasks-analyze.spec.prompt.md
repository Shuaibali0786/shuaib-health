---
id: 001
title: Spec plan tasks analyze 2FA
stage: spec
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 011-admin-two-factor
branch: 011-admin-two-factor
user: Shuaibali0786
command: /sp.specify, /sp.plan, /sp.tasks, /sp.analyze
labels: ["2fa","totp","security","migration"]
links:
  spec: specs/011-admin-two-factor/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/011-admin-two-factor/spec.md
 - specs/011-admin-two-factor/plan.md
 - specs/011-admin-two-factor/research.md
 - specs/011-admin-two-factor/data-model.md
 - specs/011-admin-two-factor/contracts/two-factor-api.md
 - specs/011-admin-two-factor/quickstart.md
 - specs/011-admin-two-factor/tasks.md
 - specs/011-admin-two-factor/checklists/requirements.md
 - specs/011-admin-two-factor/checklists/analysis.md
tests:
 - none (planning)
---

## Prompt

2. Admin two-factor login (TOTP, authenticator app) for admin accounts, optional per user, with backup codes, and all events in the Activity log. Spec-Kit first (/sp.specify, plan, tasks, analyze). If it needs a production database migration: build and test the PR, but do NOT merge. STOP and explain the exact migration steps and the risk, so I can approve.

## Response snapshot

Wrote the spec (4 user stories, FR-001 to FR-016, assumptions A-1 to A-7) and the plan:
- TOTP in-house on the stdlib.
- The secret encrypted with AES-GCM using a new `TWO_FACTOR_KEY`.
- HMAC backup codes.
- A challenge table as the second step.
- Migration 0004.

Also wrote the research, data model, contract, quickstart and 32 tasks. The analysis found and fixed: the lock status is 429 (not 423), the pending setup key lasts 15 min, setup is refused while the password must be changed, and axe now covers all the new screens. Coverage is 100% with 0 critical issues.

## Outcome

- ✅ Impact: ready to implement; migration confirmed as needed (do not merge without approval)
- 🔁 Next prompts: implement T001–T032
- 🧠 Reflection: checking the error-code map early caught a contract mismatch
