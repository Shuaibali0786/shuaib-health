---
id: 005
title: Generate tasks catalog API integration
stage: tasks
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.tasks
labels: ["tasks", "nextjs", "resilience", "contract-tests", "e2e"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - specs/004-catalog-api-integration/tasks.md
tests:
 - none (task generation)
---

## Prompt

/sp.tasks (no additional input)

## Response snapshot

Generated tasks.md with 80 tasks in 7 phases, each ending in a CHECKPOINT (user asked for a checkpoint after each phase):
- Setup & Baseline: T001–T006, including visual screenshots + Lighthouse baseline.
- Foundational: T007–T029 — fixtures move, additive types incl. widening SiteConfig.timeZone from the "Asia/Karachi" literal to string, generated types, zod, recorded fixtures, 3 contract test files, http/paginate/cached/load layer TDD, DataUnavailable, mock API server, Playwright webServer array + offline config.
- US1: T030–T047. US2: T048–T057. US3: T058–T069. US4: T070–T073.
- Polish: T074–T080.

Tests are written before the code they cover; existing tests are re-pointed to tests/fixtures. While writing tasks I found that route-segment revalidate must be a static literal, so e2e recovery testing via env-shortened revalidate is impossible. Recovery is instead proved by a unit test plus a manual timed check (T050/T075).

## Outcome

- ✅ Impact: tasks.md ready for /sp.implement (MVP = Phases 1–4)
- 🧪 Tests: none run
- 📁 Files: tasks.md
- 🔁 Next prompts: /sp.analyze (optional) then /sp.implement phase by phase
- 🧠 Reflection: Grounding tasks in actual file lists (the tests importing @/data, the content.ts consumers) surfaced the timeZone literal type gap and the MapEmbed client-component prop change.

## Evaluation notes (flywheel)

- Failure modes observed: initial draft used an env-driven segment revalidate (invalid in Next); corrected
- Graders run and results (PASS/FAIL): format check (checkbox, ID, story labels only in US phases) PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
