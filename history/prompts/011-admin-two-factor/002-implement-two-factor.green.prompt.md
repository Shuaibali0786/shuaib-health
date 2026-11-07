---
id: 002
title: Implement admin two-step sign-in
stage: green
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 011-admin-two-factor
branch: 011-admin-two-factor
user: Shuaibali0786
command: implement feature 011 (from the batch prompt, item 2)
labels: ["2fa","totp","migration","security","incident"]
links:
  spec: specs/011-admin-two-factor/spec.md
  ticket: null
  adr: history/adr/0014-two-factor-encrypted-secret-and-challenge-step.md
  pr: null
files:
 - backend/app/auth/{totp,secretbox,two_factor,service,audit,sessions,policies,create_admin}.py
 - backend/app/{models,settings,errors}.py, backend/app/routers/{admin_auth,admin_staff}.py, backend/app/booking/retention.py
 - backend/migrations/versions/0004_two_factor.py
 - frontend/src/admin/{auth,account,staff,activity,lib}/*, frontend/src/app/api/admin/session/**, frontend/src/app/(admin)/admin/(app)/account/security/*
 - specs/003-catalog-api/contracts/openapi.yaml (v1.3.0), specs/006-clinic-command-centre/contracts/auth-matrix.md
 - docs/runbooks/two-factor.md, docs/runbooks/migration-0004.md
tests:
 - backend 31 unit, 25 API, 18 migration, 367 contract/policy, 332 auth matrix, retention
 - frontend vitest 1529, playwright admin-two-factor 10 (desktop+mobile)
---

## Prompt

2. Admin two-factor login (TOTP, authenticator app) for admin accounts, optional per user, with backup codes, and all events in the Activity log. Spec-Kit first (/sp.specify, plan, tasks, analyze). If it needs a production database migration: build and test the PR, but do NOT merge. STOP and explain the exact migration steps and the risk, so I can approve.

## Response snapshot

Built the backend (TOTP, AES-GCM secret, HMAC backup codes, challenge step, shared lockout, admin and operator reset, migration 0004) and the website (code step with a challenge cookie, Security page with QR and backup codes, Staff reset, Activity labels), plus the contract, ADR-0014 and runbooks. Draft PR; not merged.

Incident: pushing the branch ran migration 0004 on the **preview** database through the preview build. It was reported, recorded in a runbook and in memory, and no further preview DB action was taken.

## Outcome

- ✅ Impact: ready for owner approval of the migration
- 🧪 Tests: see results.md; the full local suites were stopped by the memory guard, so CI covers them
- 🧠 Reflection: check what a push triggers (preview builds migrate) before pushing a migration
