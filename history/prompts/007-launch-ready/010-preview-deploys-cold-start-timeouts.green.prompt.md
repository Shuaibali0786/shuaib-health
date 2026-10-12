---
id: 010
title: Vercel projects via CLI, preview deploys, cold-start fix
stage: green
date: 2026-10-12
surface: agent
model: claude-sonnet-5-5
feature: 007-launch-ready
branch: fix/cold-start-timeouts
user: Shuaibali0786
command: owner-action follow-ups (T057, T058, T109, T059) and decision C
labels: ["launch-ready", "vercel", "preview", "cold-start", "uptimerobot", "timeouts"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011
  pr: null
files:
  - frontend/src/lib/api/http.ts, paginate.ts, app/api/booking/slots/[doctorSlug]/route.ts and their tests
  - docs/runbooks/first-deploy.md, specs/007-launch-ready/{data-model,quickstart,tasks}.md
  - specs/007-launch-ready/results/{preview-smoke-2026-10-12,cold-start}.md, docs/incidents/2026-10-12-database-role-passwords-in-screenshot.md
tests:
  - Vitest: api-http, api-paginate, api-cached, booking-slots-route, api-load pass; CI is the gate
---

## Prompt

Owner decisions this session (summarised, none contained secrets): create both Vercel projects with the CLI (production deploy only on explicit go-ahead; scripts for secrets written to D:\private and run by the owner; the assistant never reads the secret files); seed the preview database (owner-run script); then "Go with C": raise the catalog fetch timeout and the slots lookup timeout to 8 s with tests keeping last-good data on failure, keep the API function warm through UptimeRobot on /health only (no ping that keeps Neon awake 24/7), re-measure cold start on preview, merge PR #13 once CI is green, and no production deploy, migration or seed until told.

## Response snapshot

Created and configured shuaib-health-api and shuaib-health-web (roots, Node 24, sin1, GitHub connected, production builds held by an ignored-build-step command). The owner's script set 30 variables (15 per scope). Found and fixed a hidden BOM in stdin values before writing the script. Preview deploys built and passed smoke and click-through checks. Cold-start gate failed on the first catalog request after idle (4.0-6.0 s against a 3 s timeout). PR #13 merged. This change raises the two timeouts to 8 s (shared constant) and records the one-monitor UptimeRobot decision: a website `/` ping every 5 min would keep Neon awake around the clock, about 180 CU-hours a month against a Free allowance below that.

## Outcome

- ✅ Impact: cold API no longer times out the first catalog or slots request; last-good data behaviour unchanged.
- 🧪 Tests: updated the numeric budget in three existing tests (3000 to 8000, 2500 to 7500) and added two; CI is the gate.
- 📁 Files: see list.
- 🔁 Next prompts: UptimeRobot monitor (T076), re-measure with a warm function, then the production go-ahead.
- 🧠 Reflection: Vercel makes the first Git deployment of a project a Production one; the production hold cancelled it. Passing values to the Vercel CLI from PowerShell adds a BOM unless the console input encoding is changed.

## Evaluation notes (flywheel)

- Failure modes observed: BOM in piped values; cold-start test order hid the true catalog-first cold time until re-run; script selector mismatches in the click-through.
- Graders run and results (PASS/FAIL): preview smoke PASS; click-through PASS; cold-start gate FAIL then fix.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): a keep-warm ping on /health, then measure catalog-first again.
