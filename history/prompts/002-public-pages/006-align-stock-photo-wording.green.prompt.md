---
id: 006
title: Align Stock Photo Wording
stage: green
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: general request
labels: ["honesty", "alt-text", "docs"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/data/doctors.ts
 - frontend/src/components/home/FeaturedDoctors.tsx
 - specs/002-public-pages/spec.md, plan.md, tasks.md, quickstart.md
 - specs/001-brand-home-page/image-manifest.md
tests:
 - lint, typecheck, unit tests
---

## Prompt

Yes to both: reword the doctor photo alt text to "Stock photo of a model presented as sample doctor Dr. X: ..." and align FR-014, the plan and docs with the new wording. Commit. Then continue with the next phases (Departments, Lab Tests, Health Packages), committing and stopping at each checkpoint.

## Response snapshot

Reworded the nine doctor photo alts, the Home featured-doctors intro (it also said the photos "are not real"), FR-014, the plan, T031, the quickstart and the Feature 001 image manifest; tests updated to match.
