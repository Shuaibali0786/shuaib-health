---
id: 017
title: Gitattributes, 409 check, re-measure and PR
stage: misc
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.git.commit_pr
labels: ["gitattributes", "line-endings", "booking-limits", "lighthouse", "bundle-size", "pr"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - .gitattributes
 - specs/005-appointment-booking/results.md
tests:
 - fresh clone: api-contract + api-contract-drift 41 passed; full vitest 862 passed, 1 skipped (no build output)
 - 409 reproduced: booking_limit_reached; dev max_active_bookings_per_phone = 3
 - re-measured per-page JS and Lighthouse mobile on fresh clones of 1ceefa0 and the PR head
---

## Prompt

Good work. Next:
1. Yes, add the .gitattributes rule (LF for schema.gen.ts / generated files), renormalize, and prove the 2 Vitest tests pass on a fresh clone.
2. Confirm the 409s: check the error code returned. Was it the "3 active bookings per phone" limit? One line answer.
3. Show me the JS bundle before/after table again (per page: booking, doctors, home) plus Lighthouse mobile for /book-appointment and Home.
4. Commit and push. Then create the PR to main with gh (/sp.git.commit_pr). Do NOT merge. Give me the PR link and a short summary.

## Response

Added `*.gen.ts text eol=lf` (renormalize changed nothing else); on a fresh clone schema.gen.ts is LF and both contract tests pass. The 409s were `booking_limit_reached`; the dev limit is 3. Re-measured on fresh clones: home 280.6 → 162.1 kB, doctors 287.7 → 169.2, booking 267.5 → 218.2; Lighthouse booking 81 → 86, home 85 → 85. Committed, pushed, PR opened to main (not merged).
