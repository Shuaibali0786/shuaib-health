---
id: 029
title: Merge 2FA and CSP fix
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 011-admin-two-factor
branch: main
user: Shuaibali0786
command: owner decisions (migration approval, key, CSP fix)
labels: ["merge","migration","2fa","csp","smoke-test"]
links:
  spec: specs/011-admin-two-factor/spec.md
  ticket: null
  adr: history/adr/0014-two-factor-encrypted-secret-and-challenge-step.md
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/28, https://github.com/Shuaibali0786/shuaib-health/pull/29
files:
 - frontend/src/lib/contactSchema.ts
 - frontend/tests/unit/zod-jitless.test.ts
 - history/adr/0014-two-factor-encrypted-secret-and-challenge-step.md
tests:
 - CI green on #28 and #29; production smoke 11/11 after each; live CSP scan 0 violations
---

## Prompt

Decisions: 1 yes (with the steps below), 2 leave preview as it is until #28 is merged, 3 yes, 4 ADR-0014 accepted.
Note for the future: a pushed branch with a migration auto-migrates the preview database. Next time, tell me BEFORE pushing a migration branch.

Steps for #28, in this order:
a) Create the Neon restore-point branch from production yourself (Neon MCP or CLI), name it pre-2fa-2026-11-07. If you cannot, STOP and give me click-by-click steps.
b) Generate a strong TWO_FACTOR_KEY locally and write it ONLY to D:\private\two-factor-key.txt (one line). Never print it. Tell me the file is ready.
c) STOP and wait. I will add TWO_FACTOR_KEY (Secret, Production) to shuaib-health-api in Vercel myself and reply "key added".
d) After my reply: merge #28, check the build log says migrations are at head, run the smoke test, roll back the code and STOP if anything fails.

Then: open and merge a small PR for the /contact CSP fix (z.config jitless), same checks.
Report short and STOP.

(Follow-ups: "restore point done: Neon branch pre-2fa-2026-11-07 created from production (data and schema), expires 14 Nov. Continue with step b." / "key added")

## Response snapshot

a) No Neon CLI and the connector needed browser sign-in, so the run stopped and gave click steps; the owner created the branch.
b) The key was written to D:\private\two-factor-key.txt (never printed) and validated.
c) Waited for "key added".
d) #28 was updated with main, ADR-0014 accepted, CI green, merged as 3739da9. The API build log said "migrations are at head" and the smoke test passed 11/11. #29 (contact jitless) had CI green and was merged as d7f6aca; smoke 11/11; the live CSP scan found 0 violations.

## Outcome

- ✅ Impact: two-step sign-in live (available, opt-in); CSP report-only clean
- 🔁 Next prompts: enrol the real admin; consider SITE_SECURITY_HEADERS=enforce after a clean Sentry window
