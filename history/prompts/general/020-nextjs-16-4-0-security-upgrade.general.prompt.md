---
id: 020
title: Next.js 16.4.0 security upgrade
stage: general
date: 2026-10-09
surface: agent
model: claude-sonnet-5-5
feature: none
branch: chore/nextjs-16.4.0
user: Shuaibali0786
command: (overnight run) Task 2 - chore/nextjs-16.4.0
labels: ["dependencies","next","security","npm-audit"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/package.json
 - frontend/package-lock.json
 - history/prompts/general/020-nextjs-16-4-0-security-upgrade.general.prompt.md
tests:
 - npm audit, tsc, eslint, Vitest, next build, Playwright main/admin/admin-visual (see PR table)
---

## Prompt

Overnight run, Task 2: branch chore/nextjs-16.4.0 (frontend only; high-severity security fix). Upgrade next and
eslint-config-next to exactly 16.4.0, commit the lockfile; read the 16.4 release notes and stop if more than
small obvious changes are needed; run npm audit, tsc, eslint, full Vitest, production next build, full
Playwright main, the admin projects and admin-visual (no snapshot updates) one at a time; check whether the
NoFallbackError in next dev is gone; write a PHR; commit, push, open a PR with a results table; do not merge.

## Response snapshot

Upgraded both packages to exactly 16.4.0. The release notes list no breaking changes, so no source edits were
needed. The `next` advisory (high, 16.0.0-16.3.7) no longer appears in npm audit; the remaining 6 highs are
transitive `braces` and `source-map-js` (and dependents), unrelated to this change. All suites passed with no
snapshot updates. NoFallbackError: 0 occurrences on the `dynamicParams = false` route in a next dev check.

## Outcome

- ✅ Impact: Next.js security advisory cleared with a two-line dependency change plus lockfile.
- 🧪 Tests: all green (table in PR).
- 📁 Files: package.json, package-lock.json.
- 🔁 Next prompts: address braces / source-map-js transitive advisories on a separate branch.
- 🧠 Reflection: an existing `next dev` on port 3000 held the dir lock, so the dev check ran from a scratch copy.

## Evaluation notes (flywheel)

- Failure modes observed: Turbopack rejects a junction to node_modules; a physical copy worked.
- Graders run and results (PASS/FAIL): PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): n/a
