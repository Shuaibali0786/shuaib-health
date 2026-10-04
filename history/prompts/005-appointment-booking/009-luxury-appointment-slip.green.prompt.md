---
id: 009
title: Luxury appointment slip
stage: green
date: 2026-10-04
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["booking", "confirmation", "pdf", "qr", "design", "e2e"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/005-appointment-booking/spec.md
 - specs/005-appointment-booking/tasks.md
 - specs/003-catalog-api/contracts/openapi.yaml
 - specs/005-appointment-booking/contracts/booking-api.openapi.yaml
 - backend/app/schemas.py
 - backend/app/booking/service.py
 - frontend/src/lib/booking/qr.ts
 - frontend/src/lib/booking/slip.ts
 - frontend/src/lib/booking/labels.ts
 - frontend/src/lib/booking/schemas.ts
 - frontend/src/lib/api/schema.gen.ts
 - frontend/src/components/booking/ConfirmationCard.tsx
 - frontend/src/components/booking/ConfirmationActions.tsx
 - frontend/src/app/book-appointment/confirmed/[reference]/page.tsx
 - frontend/src/app/globals.css
tests:
 - frontend/tests/unit/booking-qr.test.ts
 - frontend/tests/unit/booking-slip.test.ts
 - frontend/tests/unit/booking-confirmation-card.test.tsx
 - frontend/tests/e2e/confirmation-slip.spec.ts
 - backend/tests/api/test_appointments_api.py
---

## Prompt

/sp.implement Feature 005 (specs/005-appointment-booking). Do ONLY this, then STOP. Add it to spec.md and tasks.md as an extra phase first.

Luxury appointment slip: redesign the confirmation page AND the downloaded PDF slip as a luxury, professional clinic appointment slip (same design on both, mobile-first, A5/phone-friendly; patient name/mobile stay masked; no real personal data):
1) Brand navy + teal with a subtle gold accent, elegant typography, generous spacing, faint logo watermark, ticket-style perforated divider with a stub holding the reference + QR.
2) Top highlight box: date (with year), time (PKT), and "Please arrive by <time minus 15 minutes>" (computed).
3) Round/rotated "CONFIRMED" seal-style stamp (clinic name + booking date) with a small "Demo" label.
4) QR code encoding ONLY the booking reference, labelled "Show at reception".
5) Real clinic logo (logo-mark.svg) instead of the plain cross.
6) "Before you come" box: arrive 15 minutes early, bring CNIC and previous reports, for emergencies call the clinic emergency number from settings.
7) Footer: "Booked on <date, time PKT>" + "Demo booking, no one will contact you".
8) Page fixes: "Calendar file saved" message under Add to calendar; remove the big gap between Download and the secondary buttons.

Keep all existing tests green; if a step hangs over 15 minutes, STOP and tell me. Commit, push, then STOP with a short summary.

## Response

Added FR-057a/b and Phase 4c (T114-T120). Added `bookedAt` to the booking view (backend, both contract files, generated types, zod, mock). Wrote a dependency-free QR encoder (verified against a real decoder for versions 1-10), rebuilt the card and the PDF on one design, fixed the desktop gap (grid rows) and moved the calendar message under its button. All suites green.
