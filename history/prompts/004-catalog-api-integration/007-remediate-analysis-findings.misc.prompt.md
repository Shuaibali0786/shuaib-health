---
id: 007
title: Remediate analysis findings in spec artifacts
stage: misc
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: remediation of /sp.analyze findings
labels: ["analyze", "remediation", "e2e-design", "constitution", "honesty"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - specs/004-catalog-api-integration/tasks.md
 - specs/004-catalog-api-integration/plan.md
 - specs/004-catalog-api-integration/data-model.md
 - specs/004-catalog-api-integration/spec.md
 - specs/004-catalog-api-integration/research.md
 - specs/004-catalog-api-integration/contracts/data-access.md
 - specs/004-catalog-api-integration/contracts/mock-api.md
 - specs/004-catalog-api-integration/quickstart.md
tests:
 - none (planning artifacts only)
---

## Prompt

Yes. Apply fixes for C1-C5, K1-K2, K3, A1, L4, and the medium items K4, K5, U1, U2 in tasks.md, data-model.md, plan.md and spec.md. Accept K6 and L1-L3 with a short note. Then re-run the analysis checks and show me the new counts (Critical/High/Medium/Low). Commit the spec changes.

## Response snapshot

Recovered the 18-finding report (IDs C1–C5, K1–K6, A1, U1–U2, L1–L4) from the earlier session transcript and applied all requested fixes:
- C1–C5: three Playwright configs. Main = prod build, ok mode only, ignores stateful/ and offline/. Stateful = 1 worker on `next dev`, `CATALOG_DATA_REVALIDATE_SECONDS=3`, warm and cold servers, mock `/__log` proof of API calls, cache-guard spec. Offline = separate `NEXT_DIST_DIR` per build.
- K1/K2: `src/lib/honesty.ts` constants rendered always (T084); offline/rebrand specs assert the credit text and href.
- K3: no `server-only` package (Next 16 handles it, docs cited); Vitest stub alias.
- K4: constitution phase label in the tasks header. K5: gitleaks in T079.
- A1: one 3 s budget per resource across pages (FR-011, T016/T017/T019/T020).
- L4: FR-020 first-visit exception. U1: dangling refs in T031. U2: `rename` mode + T083.
- K6, L1–L3 accepted in the plan's "Accepted analysis findings".
- Consistency edits in research R2, contracts/data-access.md, contracts/mock-api.md, quickstart.md.

Re-analysis: open C0 / H0 / M0 / L3; accepted M1 (K6) / L3 (L1–L3). Tasks 80 → 84; coverage 40/40.

## Outcome

- ✅ Impact: failure-path e2e tests can no longer pass without reaching the API; honesty text can't be removed by data
- 🧪 Tests: none (spec stage)
- 📁 Files: 8 spec artifacts edited
- 🔁 Next prompts: amend ADR-0004 (dev-dep list, test-only revalidate override, harness modes) with consent; then /sp.implement
- 🧠 Reflection: verifying Next internals (unstable_cache stale path, waitUntil for pending revalidates, server-only handling) before committing the test design avoided building on assumptions

## Evaluation notes (flywheel)

- Failure modes observed: the earlier analysis findings were lost on /clear and had to be recovered from the transcript
- Graders run and results (PASS/FAIL): re-analysis — 0 CRITICAL, 0 HIGH
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): put the finding IDs into the analysis PHR so they survive /clear
