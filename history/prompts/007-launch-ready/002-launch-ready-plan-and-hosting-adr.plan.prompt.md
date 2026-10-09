---
id: 002
title: Launch ready plan and hosting ADR
stage: plan
date: 2026-10-09
surface: agent
model: claude-opus-5-5
feature: 007-launch-ready
branch: 007-launch-ready
user: Shuaibali0786
command: /sp.plan + /sp.adr launch-hosting-and-deploy-strategy
labels: ["deployment", "hosting", "vercel", "render", "neon", "backups", "adr"]
links:
  spec: specs/007-launch-ready/spec.md
  ticket: null
  adr: history/adr/0011-launch-hosting-and-deploy-strategy.md
  pr: null
files:
 - specs/007-launch-ready/spec.md
 - specs/007-launch-ready/plan.md
 - specs/007-launch-ready/research.md
 - specs/007-launch-ready/data-model.md
 - specs/007-launch-ready/quickstart.md
 - specs/007-launch-ready/contracts/ops-endpoints.md
 - specs/007-launch-ready/contracts/required-settings.md
 - specs/007-launch-ready/contracts/ci-checks.md
 - history/adr/0011-launch-hosting-and-deploy-strategy.md
 - CLAUDE.md
tests:
 - none (plan stage)
---

## Prompt

Answers:
Q1: Backups go to my Google Drive, encrypted before upload, keep 14 days. If automating Drive upload adds too much risk/complexity for the free phase, propose the simplest safe alternative.
Q2: Treat the live site as a non-commercial portfolio demo: no prices, no sales pitch, no "hire us" button. Move to Vercel Pro before the first paying client (money rule). Record this in the spec.

NEW constraint, add to the spec: my Render account ALREADY runs kbg-backend (burger site), kept awake 24/7 by UptimeRobot (~744 h/month). Two always-on services won't fit in 750 free hours. Add a requirement that the clinic backend must stay fast (speed promise) AND $0, without breaking the burger site.

Then run /sp.plan. In the plan, research and compare (with current official sources, checked today):
(a) whether Render's 750 h is per workspace or per service, and whether a second workspace is allowed by Render's terms;
(b) running FastAPI on Vercel (Python functions, region sin1) next to the frontend;
(c) other genuinely free always-on options near Singapore (e.g. Koyeb, Google Cloud Run free tier), noting cold starts, card requirements and limits.
Recommend ONE with clear tradeoffs, and capture it with /sp.adr launch-hosting-and-deploy-strategy.
Do NOT create accounts, write code or deploy. Stop after the plan + ADR and show me a short summary and any decision I must make.

## Response snapshot

Spec updated: Clarifications session 2026-10-09 (Q1, Q2, kbg-backend constraint), FR-074 (clinic API fast, $0, burger site untouched), FR-075 (no commercial content on Hobby), FR-056 (Drive default, 14 days, safe alternative allowed). The API host moved from fixed to plan-decided.
Research (official docs, 2026-10-09):
- Render's 750 h is per workspace, and running out suspends all free services; no explicit terms clause on a second workspace, so treated as a risk.
- Vercel Python supports FastAPI and lifespan, Hobby allows a single region (sin1 settable); Hobby gives 4 h Active CPU and 1M invocations, shared.
- Koyeb free is not in Singapore and needs a card; Cloud Run needs a billing account and Singapore is Tier 2; Oracle Always Free reclaims idle VMs.
Recommendation: FastAPI as a second Vercel Hobby project in sin1; migrations in the production build; Neon prod project with main/preview branches; UptimeRobot DB-touching checks hourly; Sentry; backups as age-encrypted artifacts in a private GitHub repo, 14 days, with a manual monthly Drive copy (Drive automation rejected: OAuth refresh-token risk and expiry).
Constitution deviation flagged (Tech Stack says Render): amendment needed. ADR-0011 written (Proposed).

## Outcome

- ✅ Impact: plan, research, data model, 3 contracts, quickstart, ADR-0011
- 🧪 Tests: none (plan stage)
- 📁 Files: listed above
- 🔁 Next prompts: owner approves ADR-0011 → /sp.constitution amendment → /sp.tasks
- 🧠 Reflection: the burger-site constraint flipped the host choice; per-workspace hours confirmed in official docs

## Evaluation notes (flywheel)

- Failure modes observed: no create-adr script found (ADR written manually); Render terms page not fully fetchable; Cloud Run pricing page truncated (tier info via official locations page in search)
- Graders run and results (PASS/FAIL): ADR checklist (clustered, alternatives, pros/cons, concise) PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
