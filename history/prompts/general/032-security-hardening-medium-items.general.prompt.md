---
id: 032
title: Security hardening medium items
stage: general
date: 2026-11-07
surface: agent
model: claude-sonnet-5-5
feature: none
branch: fix/security-hardening-medium
user: Shuaibali0786
command: fix medium/low items from the security review
labels: ["security","csp","access-log","lockout","rate-limit","actions-pinning"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/lib/security-headers.ts
 - frontend/next.config.ts
 - backend/app/middleware/access_log.py
 - backend/app/auth/service.py
 - backend/app/routers/admin_bookings.py
 - backend/app/booking/limits.py
 - backend/app/settings.py
 - .github/workflows/ci.yml
 - .github/workflows/update-linux-baselines.yml
 - .github/actions/frontend-e2e-setup/action.yml
tests:
 - backend targeted suites (392 passed), ruff, mypy
 - frontend vitest (1552 passed), tsc, eslint
 - playwright desktop + admin-desktop against a SITE_SECURITY_HEADERS=enforce build (773 passed)
---

## Prompt

Fix in ONE PR, with tests, same merge process: (1) T069 CSP enforce for the public site and a script CSP for the staff app; (2) access log records the route template; (3) change_password wrong guesses count toward the per-email lockout; (4) limit "Reveal phone" per session (still logged); (5) pin GitHub Actions to commit SHAs. Not now: required admin 2FA and the other low items. No migration expected. Report short and STOP.

## Response snapshot

Implemented all five on branch fix/security-hardening-medium, no migration. CSP enforcement is the existing SITE_SECURITY_HEADERS env var (needs a Vercel change after merge); the staff CSP follows the same mode (off: framing only; report: Report-Only script policy; enforce: full policy).

## Outcome

- Impact: five review items closed; no schema change
- Next: merge when CI is green, smoke test, then flip SITE_SECURITY_HEADERS to enforce on Vercel
