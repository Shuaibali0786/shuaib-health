---
id: 033
title: Upcoming bookings, New badge, bell
stage: general
date: 2026-11-07
surface: agent
model: claude-sonnet-5-5
feature: 012-upcoming-bookings
branch: feat/upcoming-bookings
user: Shuaibali0786
command: build upcoming bookings view, New badge, bell, booked-on, cards, email alerts (OFF)
labels: ["command-centre","bookings","migration","email-alerts"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - backend/migrations/versions/0005_booking_seen.py
 - backend/app/command_centre/service.py
 - backend/app/notifications/
 - frontend/src/admin/shell/NewBookingsBell.tsx
 - frontend/src/admin/bookings/BookingsScreen.tsx
tests:
 - backend 853 api + 499 unit/migration passed; frontend 1583 unit, 2049 e2e passed
---

## Prompt

Make the Command Centre the real control room for upcoming bookings: Upcoming view grouped by day, New badge per staff user, bell, Booked on column and Recently booked filter, search across all dates, Overview cards, email alerts behind a flag (OFF). Keep masked phone, audit, mobile, themes, Lighthouse >= 90, accessibility; update the Fiverr screenshots. Migration only after approval and a Neon restore point.

## Response snapshot

Built migration 0005_booking_seen (additive), backend, demo source, contract, frontend, tests, screenshots; email alerts prepared and OFF.

## Outcome

- Impact: owner approved the migration; restore point pre-0005-2026-11-07 created by the owner
- Next: push, PR, CI, Linux baselines, Lighthouse, merge, smoke test
