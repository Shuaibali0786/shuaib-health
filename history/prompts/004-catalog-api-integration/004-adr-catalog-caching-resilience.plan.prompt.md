---
id: 004
title: ADR catalog caching and resilience
stage: plan
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.adr catalog-caching-and-resilience-strategy
labels: ["adr", "caching", "resilience", "nextjs", "architecture"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - history/adr/0004-catalog-caching-and-resilience-strategy.md
 - specs/004-catalog-api-integration/plan.md
tests:
 - none (planning stage)
---

## Prompt

/sp.adr catalog-caching-and-resilience-strategy

## Response snapshot

No create-adr script exists in .specify/scripts/powershell, so ADR-0004 was written from .specify/templates/adr-template.md. One clustered ADR covers: unstable_cache boundary (revalidate 300, per-resource tags) with throw-to-keep-stale semantics, 3 s timeout, static/ISR pages, Loaded<T> section-level fallback, clinic identity precedence with CLINIC_FALLBACK_JSON, list-only parallel fetching, safe generateStaticParams + dynamicParams=true, server-only config, generated types + zod with 5 drift checks, mock-API test harness. Seven alternatives (fetch cache + ISR, use cache/cacheComponents, custom store, fully dynamic, detail endpoints, bundled fallback data, hand-written/generated clients). Checked against ADR-0001..0003: no hard conflict; documented tension with ADR-0002 (env-based clinic config was rejected there; here bounded to emergency fallback) and the not-yet-flipped seed direction. Plan.md now links ADR-0004. Contract typing was folded into this ADR rather than a separate one (it changes together with the data-access layer).

## Outcome

- ✅ Impact: ADR-0004 created (Proposed); plan linked
- 🧪 Tests: none
- 📁 Files: ADR-0004, plan.md
- 🔁 Next prompts: /sp.tasks
- 🧠 Reflection: Recording the ADR-0002 tension explicitly keeps the fallback env var from quietly growing into a second source of truth.

## Evaluation notes (flywheel)

- Failure modes observed: create-adr script missing (handled with template)
- Graders run and results (PASS/FAIL): clustered PASS; alternatives with rationale PASS; pros/cons PASS; concise-but-sufficient PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
