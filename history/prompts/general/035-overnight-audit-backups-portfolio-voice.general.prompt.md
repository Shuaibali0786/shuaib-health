---
id: 035
title: Overnight audit, backups, portfolio, voice plan
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: chore/overnight-2026-11-07
user: Shuaibali0786
command: overnight unattended run (pasted task list)
labels: ["licences","backups","lighthouse","seo","accessibility","portfolio","voice-agent"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - CREDITS.md
 - docs/runbooks/backup-setup.md
 - docs/runbooks/restore-drill.md
 - scripts/backups/restore-drill.ps1
 - scripts/backups/drill-counts.sql
 - frontend/src/lib/og.tsx
 - frontend/src/lib/pages.ts
 - frontend/src/app/(site)/{about,doctors,departments,lab-tests,health-packages,health-tips,contact,faq,privacy,terms,book-appointment,demo/specialties}/opengraph-image.tsx
 - frontend/src/app/(site)/{doctors,departments,lab-tests,health-tips}/page.tsx
 - frontend/tests/unit/og-sections.test.ts
 - frontend/tests/e2e/a11y.spec.ts
 - frontend/tests/e2e/seo.spec.ts
 - docs/reports/site-audit-2026-11-07/
 - docs/portfolio/
 - docs/voice-agent/roles-draft.md
 - docs/reports/overnight-2026-11-07.md
tests:
 - frontend vitest full suite (1604 passed)
 - npm run typecheck (pass)
 - eslint on changed files (pass)
 - e2e seo/a11y/no-localhost (NOT run: stopped for low memory; left for CI)
---

## Prompt

Overnight work on Shuaib Health. I am asleep and cannot approve anything.

HARD RULES (do not break):
- Do NOT merge, do NOT deploy, do NOT touch production or ANY Neon database (no migrations, no queries, no branches).
- Do NOT delete files outside your new branch. Never print or save secrets.
- Work on ONE new branch "chore/overnight-2026-11-07". You may push it and open a DRAFT PR so CI runs. Leave it unmerged.
- If something needs my approval, write it in the report and move on to the next task.

TASKS, in order:
1. Image licence audit (read-only): list every image/icon/font used on the site with its source and licence. Flag anything with no clear free-commercial licence (Unsplash/Pexels/Pixabay/AI/own). Create or update CREDITS.md.
2. Backups prep (T083-T087): write docs/runbooks/backup-setup.md with exact steps for Neon backups/restore and a monthly restore drill. Prepare any scripts but do NOT run them against any database.
3. Public-site audit on the LIVE site (read-only, no logins): Lighthouse (performance, accessibility, SEO, best practices) for every public page at desktop and mobile, broken links, missing alt text, meta titles/descriptions, sitemap/robots. Fix small safe issues on the branch (no database or API contract changes) with tests.
4. Fiverr portfolio pack in docs/portfolio/: full-page screenshots (desktop + mobile) of the public pages and the read-only Demo Dashboard; a one-page case study (problem, features, tech stack, security, speed scores); a feature list; 5 gig keywords. No real secrets or staff emails in any screenshot.
5. AI voice agent PLAN only (no code): docs/voice-agent/roles-draft.md with what the agent will do and will NOT do, languages (English, Urdu, Arabic), public data only, booking lookup only with reference + last 4 phone digits, escalation to a human, red-team list of at least 30 attack prompts, and 2-3 provider options with rough monthly cost. This is for my approval tomorrow.

At the end: run the affected test suites, push the branch, open the DRAFT PR, and write docs/reports/overnight-2026-11-07.md: what was done, what needs my approval, any risks. Keep the final chat report short. Then STOP.

## Response snapshot

All five tasks done on chore/overnight-2026-11-07 (3 local commits + report commit). Live audit of 65 pages: mobile perf 95-99, desktop 100, a11y 98-100, BP 100, SEO capped by intended noindex; fixed missing og:image on 16 pages, heading order on 4 listing pages, short booking description, with tests. Branch NOT pushed: every push deploys an API preview whose build runs alembic against the preview Neon DB, which the hard rules forbid; recorded as approval item A1. Photo dr-bilal-ansari flagged as likely not Pexels; general-medicine metadata says "permission of the artist".

## Outcome

- ✅ Impact: licence register, backup/drill runbook + scripts, audit with 3 fixes, portfolio pack, voice agent plan ready for approval
- 🧪 Tests: vitest 1604/1604, typecheck and lint pass; e2e not run locally (memory), pending CI
- 📁 Files: see list above
- 🔁 Next prompts: approve push/draft PR (A1); resolve photo licences (A2-A4); voice agent decisions (A5)
- 🧠 Reflection: "push so CI runs" conflicts with "no Neon queries" because Vercel previews migrate on every push; checked against PR #35 before deciding

## Evaluation notes (flywheel)

- Failure modes observed: background e2e run killed by low memory; Vercel MCP lacked team authorization
- Graders run and results (PASS/FAIL): vitest PASS, tsc PASS, eslint PASS, gitleaks PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): add a Vercel ignored-build step for API previews when backend/ is unchanged
