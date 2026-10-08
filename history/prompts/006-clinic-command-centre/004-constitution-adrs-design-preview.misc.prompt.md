---
id: 004
title: Constitution ADRs and Design Preview
stage: misc
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.constitution + /sp.adr + design preview
labels: ["constitution", "adr", "design-gate", "preview", "typography"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md, history/adr/0008-command-centre-isolation-and-bff.md, history/adr/0009-demo-mode-deterministic-data-source.md, history/adr/0010-booking-status-lifecycle-and-concurrency.md
  pr: null
files:
 - .specify/memory/constitution.md
 - .specify/templates/plan-template.md
 - specs/006-clinic-command-centre/plan.md
 - history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md
 - history/adr/0008-command-centre-isolation-and-bff.md
 - history/adr/0009-demo-mode-deterministic-data-source.md
 - history/adr/0010-booking-status-lifecycle-and-concurrency.md
 - history/prompts/constitution/002-amend-principle-vi-session-tokens.constitution.prompt.md
 - specs/006-clinic-command-centre/design-preview/index.html
 - specs/006-clinic-command-centre/design-preview/preview.html
 - specs/006-clinic-command-centre/design-preview/preview.css
 - specs/006-clinic-command-centre/design-preview/data.js
 - specs/006-clinic-command-centre/design-preview/render.js
 - specs/006-clinic-command-centre/design-preview/capture.mjs
 - specs/006-clinic-command-centre/design-preview/README.md
 - specs/006-clinic-command-centre/design-preview/screenshots/*.png (32)
tests:
 - capture.mjs rendered all 32 variants without error
 - file:// smoke test of index.html: 0 console errors, 32/32 thumbnails load
---

## Prompt

Approved. Do these in order, then STOP:
1. Amend constitution Principle VI to "a JWT or an opaque server-side session token" via /sp.constitution (small amendment, bump version, sync dependent templates).
2. Create all 4 ADRs you listed.
3. Commit + push.
4. Build the design preview: Overview + Bookings, phone 390px and desktop 1440px, light and dark, demo data. Make TWO heading-font variants: (A) a luxury serif (Cormorant Garamond or similar) and (B) Plus Jakarta Sans like the website, so I can compare. Premium UK private-clinic feel, navy/teal/gold.
5. Save screenshots of every variant (PNG) in the design-preview folder and tell me exactly how to open the preview in my browser.
Do not write feature code. STOP after the preview and wait for my approval.

## Response snapshot

1) Constitution 1.0.0 → 1.0.1 (PATCH), Principle VI now allows a JWT or an opaque server-side session token (hash-only storage); plan-template gate and 006 plan Constitution Check/Complexity Tracking synced. 2) ADR-0007 staff auth (opaque sessions + policy table), ADR-0008 isolation + allow-listed BFF, ADR-0009 demo data source, ADR-0010 status lifecycle (amends ADR-0005's exclusion predicate). 3) Commit 0eb7c0b pushed; new upstream branch origin/006-clinic-command-centre. 4) Static preview in specs/006-clinic-command-centre/design-preview: Overview (6 computed KPIs with week-on-week trends, doctor timeline with now marker, next patients up, status mix) and Bookings (filters, status chips, 20-row table / mobile cards, drawer, confirm dialog, undo toast); light + navy night; font A Cormorant Garamond vs B Plus Jakarta Sans; deterministic sample fixture. 5) 32 PNGs in screenshots/; open index.html by double-click. No frontend/ or backend/ files touched. Stopped for approval.

## Outcome

- ✅ Impact: design gate ready for owner review; auth decision now constitution-compliant; 4 ADRs recorded.
- 🧪 Tests: screenshot capture and file:// smoke test passed.
- 📁 Files: constitution, plan-template, plan.md, 4 ADRs, 2 PHRs, design-preview/* (preview files not yet committed).
- 🔁 Next prompts: owner picks font A or B and requests tweaks; commit the approved preview; then /sp.tasks.
- 🧠 Reflection: the full-page capture misplaces fixed bars, so the capture-only class pins them to the page bottom; it does not change the live preview.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell 5.1 split a commit message with embedded double quotes; fixed by committing with -F from a file.
- Graders run and results (PASS/FAIL): ADR checklist (clustered, alternatives, pros/cons, references) PASS for all 4.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
