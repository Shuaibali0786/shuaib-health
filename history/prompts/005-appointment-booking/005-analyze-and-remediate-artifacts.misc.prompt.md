---
id: 005
title: Analyze and remediate booking artifacts
stage: misc
date: 2026-10-04
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.analyze
labels: ["analyze", "remediation", "consistency", "constitution", "traceability"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: history/adr/0005-booking-integrity-db-enforcement.md, history/adr/0006-proxy-trust-and-postgres-rate-limiting.md
  pr: null
files:
 - specs/005-appointment-booking/spec.md
 - specs/005-appointment-booking/plan.md
 - specs/005-appointment-booking/data-model.md
 - specs/005-appointment-booking/tasks.md
 - specs/005-appointment-booking/research.md
 - specs/005-appointment-booking/quickstart.md
 - specs/005-appointment-booking/checklists/requirements.md
 - history/adr/0006-proxy-trust-and-postgres-rate-limiting.md
tests:
 - consistency check script (task format, story labels, FR/SC traceability, cross-artifact probes): all green
---

## Prompt

/sp.analyze Then fix all CRITICAL and HIGH issues (and MEDIUM ones if quick) in spec.md, plan.md, data-model.md and tasks.md. Re-run the checks and show the new counts. Commit the spec changes. Do not start implementing.

## Response snapshot

The analysis found 25 issues: 1 CRITICAL, 5 HIGH, 14 MEDIUM, 5 LOW.

- **CRITICAL (C1)**: the site's own wording would become false once booking ships, breaking constitution I/II.
  - `legalContent.ts` (privacy): "collects no personal data … no booking forms".
  - Terms: "holding page".
  - `faq.ts`, `aboutContent.ts`, the `pages.ts` title/description and the `DepartmentSections` note all say booking is unavailable.
  - No task updated any of them.
- **HIGH**:
  - H1: FR-076 "allowed origins" conflicted with the proxy-secret design.
  - H2: the constitution VI missing-Origin rule was not applied at the backend layer.
  - H3: FR-071 required a Book button on the doctors list, but no task covered it.
  - H4: existing tests asserting "Booking coming soon" were not listed.
  - H5: FR-055 required the website to refuse start, but dev only logs.
- **MEDIUM**:
  - Edge cases without tasks.
  - SC-001's 45 s timing not measured.
  - Key-entity drift (idempotency stores errors; rate limits listed in clinic settings).
  - Ambiguous "per 24 hours" window.
  - FR-012 reasons incomplete.
  - Plan and tasks phase numbering differed.
  - DB tests would skip misleadingly when the new secrets are missing.
  - gitleaks might flag the test secrets.
  - Audit fingerprints were kept forever and not disclosed.
  - The time-zone label was ambiguous.
  - `ComingSoon` would become dead code.
  - Stale test-file names and the old notice text in the plan.
  - 18 FRs and 7 SCs not traceable to any task ID.
- **LOW**: FR/SC ordering, plan structure, reduced-motion test, sitemap decision, leave-entity wording.

All 25 were fixed:
- **New requirements**: FR-056 (truthful site wording) and SC-013.
- **New tasks**: T088 copy tests and T093 copy update.
- **Backend**: foreign-Origin rejection added to `require_proxy_secret`, documented in research R4, ADR-0006 and the plan's Constitution Check.
- **Retention**: 90-day audit purge (`AUDIT_PURGE_AFTER_DAYS`).
- **Plan**: phase table rewritten 1:1 with tasks.
- **Traceability**: tables mapping all 41 FRs and 13 SCs to tasks.
- **Spec**: FR/SC renumbering order.

Also repaired 171 garbled characters in tasks.md. An earlier PowerShell rewrite had read the file as ANSI.

Tasks were renumbered to T001–T106, with every cross-reference remapped by script.

## Outcome

- ✅ Impact: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW remaining; artifacts consistent and committed
- 🧪 Tests: consistency script green (106 tasks well-formed and sequential; 41/41 FRs and 13/13 SCs traced; 0 dangling IDs; 0 stale phrases or encoding damage)
- 📁 Files: spec, plan, data-model, tasks, research, quickstart, checklist, ADR-0006
- 🔁 Next prompts: /sp.implement Phase 1 (T001–T007)
- 🧠 Reflection: the stale privacy page was only visible by grepping the existing site for booking copy. Spec-only analysis would have missed it.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell 5.1 `Get-Content -Raw` without `-Encoding utf8` garbled the UTF-8 file. A Python script saved as ASCII lost en-dashes, so `\u` escapes are used now.
- Graders run and results (PASS/FAIL): format PASS; story labels PASS; traceability PASS; probes PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): always edit markdown with agent tools or Python UTF-8, never PowerShell 5.1 Set-Content
