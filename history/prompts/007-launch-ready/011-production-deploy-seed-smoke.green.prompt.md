---
id: 011
title: Production deploy, seed, smoke test, proxy hops
stage: green
date: 2026-10-12
surface: agent
model: claude-sonnet-5-5
feature: 007-launch-ready
branch: docs/production-launch-results
user: owner
command: production go (T060-T065)
labels: ["production", "deploy", "smoke", "trusted-proxy-hops"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011
  pr: null
files:
  - specs/007-launch-ready/results/smoke-2026-10-12-production.md
  - specs/007-launch-ready/tasks.md
  - specs/007-launch-ready/contracts/required-settings.md
  - docs/runbooks/first-deploy.md
tests:
  - Playwright production click-through (desktop and Pixel 7), curl header checks
---

## Prompt
Owner: merge PR #14; GO for production (T060): remove the production hold, deploy API and web in sin1; owner runs the guarded production seed and admin scripts; smoke test (home, doctors, lab tests, booking, slip, /admin login, /health, headers); measure and set TRUSTED_PROXY_HOPS; give the live URL and UptimeRobot steps. Stop before any rollback or data change. Never print secrets.

## Response
Merged PR #14. Removed the hold and deployed the API (migrations at head) and the website to Production. Owner scripts were fixed after backslash loss and run by the owner. Confirmed indexable=false, smoke passed on desktop and mobile, hops measured as 1 and set. Findings: a harmless Zod `Function("")` CSP report on /book-appointment.
