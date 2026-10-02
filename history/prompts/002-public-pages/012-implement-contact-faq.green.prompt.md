---
id: 012
title: Implement Contact and FAQ
stage: green
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.implement (continuation)
labels: ["implement", "contact", "faq", "us7"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/002-public-pages/tasks.md (ticks T077-T084)
 - frontend/src/data/faq.ts, types/content.ts, lib/content.ts, lib/routes.ts, lib/contactSchema.ts
 - frontend/src/components/faq/FaqGroup.tsx, components/contact/ContactForm.tsx, MapEmbed.tsx
 - frontend/src/app/faq/page.tsx, app/contact/page.tsx
 - frontend/tests/unit/faq-group.test.tsx, contact-schema.test.ts, contact-form.test.tsx, map-embed.test.tsx, honesty.test.ts, routes.test.ts
 - frontend/tests/e2e/contact-faq.spec.ts, a11y.spec.ts, links.spec.ts
tests:
 - lint, typecheck, unit (449), playwright full suite (429 passed, 11 skipped)
---

## Prompt

First re-run the full Playwright suite to confirm everything passes after those two fixes. Then continue with Phase 9 (Contact and FAQ) and stop at the checkpoint.

## Response snapshot

Re-run before Phase 9: 395 passed, 5 skipped, 0 failed. Phase 9 (T077-T084): FAQ with five groups (22 questions, none claiming a live service), native details/summary accordions with slug anchors; Zod contact schema (phone or email, trimmed, length limits); ContactForm (React Hook Form + zodResolver, error summary takes focus once per failed submit, text kept, demo message on success, no fetch and no storage); opt-in OpenStreetMap map with a text fallback; /contact and /faq pages; placeholders removed (Privacy and Terms remain). Lint rule react-hooks/refs rejected focusing the summary from the submit handler, so focus moved to an effect keyed on submitCount. The "no request on submit" e2e ignores Next's own prefetch/chunk GETs and fails on anything else.

## Outcome

Phase 9 checkpoint reached.
