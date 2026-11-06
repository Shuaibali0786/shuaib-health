---
id: 013
title: Sentry events, redeploy and results note
stage: green
date: 2026-11-06
surface: agent
model: claude-sonnet-5-5
feature: 007-launch-ready
branch: docs/007-results-2026-11-06
user: owner
command: Sentry setup help, production redeploy, sentry-check, record results
labels: ["sentry", "uptimerobot", "redeploy", "status", "docs"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/007-launch-ready/results/STATUS-2026-11-06.md
  - specs/007-launch-ready/tasks.md
tests:
  - none (docs only)
---

## Prompt
Owner (summary of the day's requests, in order): T078 alert test is done (email 8:11 AM, 6 Nov); explain which Sentry env vars the code reads and the Vercel click path; redeploy both production projects from main c592c5e through the API (dashboard blocked by an OTP sent to an old email), check /health and home 200, no sentry-check yet; then run the API sentry-check with the production cron bearer from a local secret file (never printing it) and send one web test event with fake personal data; finally: record the day in specs/007-launch-ready/results/STATUS-2026-11-06.md, tick T075, T078, T079, commit, push, open a PR, wait for the 4 required checks, do not merge.

## Response
Only `SENTRY_DSN` is read (web and API, Production). Both projects redeployed via POST /v13/deployments from main c592c5e, READY, /health GET and HEAD 200, home 200. API sentry-check returned 500 as designed; web test event sent from a scratch copy of the real config. Owner confirmed SHUAIB-HEALTH-API-1 and SHUAIB-HEALTH-WEB-1 scrubbed. Wrote the status note (done, blocker, rollback targets, follow-ups, remaining order) and ticked T075, T078, T079.
