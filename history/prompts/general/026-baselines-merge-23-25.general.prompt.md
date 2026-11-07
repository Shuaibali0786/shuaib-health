---
id: 026
title: Baselines, merge 23 and 25
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: docs/fiverr-showcase
user: Shuaibali0786
command: owner approval of baselines and merges
labels: ["merge","smoke-test","visual-baselines","assistant","adr"]
links:
  spec: null
  ticket: null
  adr: history/adr/0012-specialty-presets-as-static-demo-showcase.md, history/adr/0013-ai-agent-provider-interface-and-local-engine.md
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/23, https://github.com/Shuaibali0786/shuaib-health/pull/25
files:
 - frontend/tests/e2e/admin-visual.spec.ts-snapshots/bookings-*.png (17 linux + 17 win32, on PR #23)
 - specs/008-command-centre-completion/tasks.md
 - history/adr/0012-specialty-presets-as-static-demo-showcase.md
 - history/adr/0013-ai-agent-provider-interface-and-local-engine.md
 - specs/007-launch-ready/results/smoke-2026-11-07-production.md
 - specs/QUESTIONS-FOR-SHUAIB.md
 - README.md
tests:
 - local admin-visual Bookings/confirmation 24 passed after regenerating win32 baselines
 - CI on #23 (run 42330811988) and #25 (run 42332402250) all green
 - production smoke 13/13 after #23 and after #25
---

## Prompt

Yes, the Print list button is expected (it is part of feature 008). Update the baselines and continue: merge #23, #25 and #26 in order with the same checks after each one.

About the assistant: I cannot use the Vercel dashboard Redeploy (it asks for a code to the old email). After #25 is live, STOP and tell me. I will add ASSISTANT_ENABLED=true (Production) in Vercel myself, then you redeploy shuaib-health-web via the Vercel API and smoke-test the assistant on the demo.

## Response snapshot

Linux baselines were set from the CI actual images and Windows baselines regenerated locally (17 each). #23 was updated with main; CI went green and it was merged as b686f9c. Deploy READY, smoke 13/13. #25 was updated with main; CI went green and it was merged as e538798. Deploy READY, smoke 13/13, assistant hidden. Stopped as asked. #26 was prepared: brought up to date with main, ADR-0012/0013 Accepted, smoke record. It is not merged and waits for the assistant step.

## Outcome

- ✅ Impact: 008, 009, 010 live on production; assistant flag still off
- 🧪 Tests: CI green on both PRs; production smoke PASS after each merge
- 🔁 Next prompts: owner sets ASSISTANT_ENABLED=true; agent redeploys web via CLI/API, smoke-tests the assistant, then merges #26
- 🧠 Reflection: `vercel ls` prints its table on stderr, and its title line also contains "Production"; match the "●" deployment rows
