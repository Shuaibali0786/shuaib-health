---
id: 027
title: Assistant on, merge 26
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: main
user: Shuaibali0786
command: owner set ASSISTANT_ENABLED and said "done"
labels: ["assistant","redeploy","smoke-test","merge"]
links:
  spec: specs/010-ai-agent/spec.md
  ticket: null
  adr: history/adr/0013-ai-agent-provider-interface-and-local-engine.md
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/26
files:
 - specs/007-launch-ready/results/smoke-2026-11-07-production.md
 - specs/QUESTIONS-FOR-SHUAIB.md
tests:
 - production smoke 11/11 + launcher presence after the redeploy and after the #26 merge
 - live assistant browser check 24/24 (desktop, Pixel 7, Dental preset page), twice
---

## Prompt

done

## Response snapshot

Confirmed that ASSISTANT_ENABLED exists for Production (name only). Redeployed shuaib-health-web with `vercel redeploy --target production` (cbg6civ7y, READY). Smoke 11/11 passed, the launcher is on the public pages and not on /admin/login, and the live assistant check passed 24/24. No error logs. #26 CI went green and it was merged as 2b424a7. Deploy dqyu0ctln READY; smoke and the assistant check passed again.

## Outcome

- ✅ Impact: Phase C fully on production with the free assistant on
- 🔁 Next prompts: Fiverr gig with docs/showcase assets; optionally re-take the showcase on production
- 🧠 Reflection: `vercel redeploy` from the CLI avoids the dashboard email-code blocker
