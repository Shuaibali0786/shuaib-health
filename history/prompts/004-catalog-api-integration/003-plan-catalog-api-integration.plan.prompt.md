---
id: 003
title: Plan catalog API integration
stage: plan
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.plan
labels: ["plan", "nextjs", "isr", "caching", "resilience", "openapi", "contract-tests"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/004-catalog-api-integration/plan.md
 - specs/004-catalog-api-integration/research.md
 - specs/004-catalog-api-integration/data-model.md
 - specs/004-catalog-api-integration/quickstart.md
 - specs/004-catalog-api-integration/contracts/data-access.md
 - specs/004-catalog-api-integration/contracts/mock-api.md
 - CLAUDE.md
tests:
 - none (planning stage)
---

## Prompt

/sp.plan Use Next.js App Router server components with fetch caching (revalidate 300s, tags per resource) and serve the last good data when the API fails. API base URL is server-only env. Typed client generated from or checked against backend/openapi.yaml. Keep all pages static/ISR-friendly so the build never needs the API. Keep current design and tests. Phase-by-phase tasks with a checkpoint after each phase.

## Response snapshot

Verified in Next 16.3.7 source: fetch cache only caches 200s and does a foreground refetch during ISR regeneration (no stale-on-error), while unstable_cache returns the stale value when a refresh throws. Plan therefore caches at unstable_cache (revalidate 300, tags per resource) around a no-store fetch with a 3 s timeout; Loaded<T> wrapper yields section-level DataUnavailable only when no last good exists. Seven list endpoints only (detail lookups from cached lists; no false 404s). Types generated with openapi-typescript from specs/003-catalog-api/contracts/openapi.yaml (backend/openapi.yaml does not exist) plus zod runtime validation and a 5-part drift check. [slug] routes switch to dynamicParams=true with safe generateStaticParams. CATALOG_API_URL and CLINIC_FALLBACK_JSON server-only. Mock API server with ok/down/slow/error500/malformed/partial modes for Playwright plus an offline build config. Logo SVG generated from logo-paths.ts. Eight phases (0 baseline → 7 polish), each with a checkpoint. Constitution check PASS. ADR suggested for the caching/resilience strategy.

## Outcome

- ✅ Impact: Plan, research, data model, contracts, quickstart ready for /sp.tasks
- 🧪 Tests: none (planning)
- 📁 Files: 6 spec artifacts + CLAUDE.md agent context
- 🔁 Next prompts: /sp.adr catalog-caching-and-resilience-strategy, then /sp.tasks
- 🧠 Reflection: User asked for fetch caching; source reading showed it cannot meet the "last good data" requirement, so the boundary moved to unstable_cache while keeping 300 s + tags.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): Constitution check PASS (pre and post design)
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
