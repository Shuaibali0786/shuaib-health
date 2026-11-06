---
id: 024
title: Overnight Phase C run
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: docs/fiverr-showcase
user: Shuaibali0786
command: unattended overnight run (pasted prompt)
labels: ["overnight","phase-c","command-centre","presets","ai-agent","showcase","fiverr"]
links:
  spec: specs/008-command-centre-completion/spec.md, specs/009-specialty-presets/spec.md, specs/010-ai-agent/spec.md
  ticket: null
  adr: history/adr/0012-specialty-presets-as-static-demo-showcase.md, history/adr/0013-ai-agent-provider-interface-and-local-engine.md
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/23, https://github.com/Shuaibali0786/shuaib-health/pull/24, https://github.com/Shuaibali0786/shuaib-health/pull/25, https://github.com/Shuaibali0786/shuaib-health/pull/26
files:
 - specs/008-command-centre-completion/*
 - specs/009-specialty-presets/*
 - specs/010-ai-agent/*
 - history/adr/0012-specialty-presets-as-static-demo-showcase.md
 - history/adr/0013-ai-agent-provider-interface-and-local-engine.md
 - docs/showcase/*
 - docs/runbooks/ai-provider.md
 - README.md
 - specs/QUESTIONS-FOR-SHUAIB.md
 - specs/MORNING-REPORT-2026-11-07.md
tests:
 - see each feature's results.md
---

## Prompt

UNATTENDED OVERNIGHT RUN (4-5 hours). Shuaib is asleep. Nobody can answer questions or approve prompts until morning.

GOAL
Shuaib Health will be Shuaib's first project on Fiverr, sold to clinics in the UK, USA, Gulf and Pakistan. It must look and feel world-class: luxury (navy, teal, gold), mobile-first, fast, secure. Tonight we build Phase C, the "wow" features that make a client hire us.

READ FIRST
docs/SAFE-CHANGE-PLAYBOOK.md, the constitution, specs/007-launch-ready/results/STATUS-2026-11-06.md, specs/007-launch-ready/tasks.md, and the existing Command Centre (feature 006) spec and code.

HARD RULES (never break)
- Merging to main auto-deploys production. Do NOT merge any PR. Do NOT deploy. Open PRs as DRAFT only.
- No production or preview database writes, no Vercel/Neon/Sentry setting or env var changes, never print secrets.
- Do not ask me questions. When a decision is needed, choose the safest reasonable option, write it under "Assumptions" in the spec, and add it to specs/QUESTIONS-FOR-SHUAIB.md.
- Avoid any command that needs approval (deleting files outside the repo, risky rm). Use the repo scratchpad for temp files. If a command is blocked, skip it and note it.
- 15-minute rule: if one step is stuck for 15 minutes, write down why and move on.
- Commit and push after every finished phase, so nothing is lost.
- Demo data only: fake names, test@example.com, 0300 1234567, free-licence images, "Portfolio demo" label. One codebase for every client: differences are settings or feature flags, never copied code.
- Keep quality: all existing tests green, Lighthouse mobile at least 90, accessibility, no heavy new dependencies without a written reason.
- No paid services and no new API keys.

WORK, IN THIS ORDER (each feature on its own branch with its own DRAFT PR)

1. Spec-Kit for three features, using the next free feature numbers. For each: /sp.specify, /sp.plan, /sp.tasks, /sp.analyze. Record big decisions as ADRs.
   a) Command Centre completion: overview stats, bookings list with filters and search, status change, doctors today, insights chart, activity/audit log, staff roles, fully mobile.
   b) "Choose your specialty" demo presets: Dental, Skin & Aesthetic, Diagnostic Lab, Multi-speciality. A visitor switches presets on the demo and the name, colours, departments, doctors and images change. Demo only, behind the existing demo flag.
   c) AI Agent with two modes: patient mode (timings, doctors, departments, lab tests, fees, then guide to booking) and product-guide mode on the demo (explains to a clinic owner what the system includes and how it looks for their specialty). Answers only from the project's own data, never patient data.

2. Build feature (a) fully, phase by phase: tests, commit, push. Open its DRAFT PR.

3. Build feature (b) fully the same way. Open its DRAFT PR.

4. Build feature (c) version 1 with NO paid AI: a provider-agnostic agent interface plus a free built-in answer engine that matches questions to the project's own data and FAQs. A luxury chat widget, mobile-friendly, rate-limited, behind a feature flag that is OFF by default. Leave a clean slot to plug in a real AI provider later. In the questions file, list 2-3 AI provider options with monthly cost estimates. Open its DRAFT PR.

5. Fiverr showcase assets (no repo app changes): with Playwright against a local build, take clean screenshots of every specialty preset (home, booking, slip, dashboard) on desktop and mobile. Save them in docs/showcase/. Also write docs/showcase/DEMO-VIDEO-SCRIPT.md, a 60-90 second demo video script, and update the README with a features section and screenshot placeholders.

STOP when everything above is done, or after about 5 hours, whichever comes first. If you hit a usage limit, write the morning report first with what is done so far.

MORNING REPORT
Write specs/MORNING-REPORT-2026-11-07.md and show it on screen at the end:
- a table: feature | spec/plan/tasks | phases done | tests | draft PR link | CI state
- what is NOT done and why
- the questions for Shuaib (short, simple English)
- what you need from me to continue, and which PR you recommend merging first

## Response snapshot

Built 008 (gap fill: quick date ranges, roles table, print list), 009 (static demo-only specialty showcase, ADR-0012) and 010 (provider interface + free local answer engine + lazy chat widget, flag off, ADR-0013), each with spec/plan/tasks/analysis/results and a draft PR (#23, #24, #25). Fixed CI findings the same night. Showcase screenshots, video script and README in draft PR #26. No merge, no deploy, no production/preview data or settings touched.

## Outcome

- ✅ Impact: Phase C features ready for review as four draft PRs
- 🧪 Tests: see the per-feature results.md files and the morning report
- 📁 Files: see list
- 🔁 Next prompts: owner review; baseline approval for #23; merge order #24 → #23 → #25 → #26
- 🧠 Reflection: the repo's guard tests (brand words, env reads, fetch sites, admin isolation, manifest) caught real issues early; run the full CI-equivalent suites before opening PRs next time

## Evaluation notes (flywheel)

- Failure modes observed: local targeted e2e subsets missed responsive and admin-isolation failures that CI caught
- Graders run and results (PASS/FAIL): see the morning report
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): run responsive + admin-isolation + honesty locally for any new public route
