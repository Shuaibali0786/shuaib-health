---
id: 018
title: Demo coherence, slip watermark, reference alphabet
stage: green
date: 2026-10-08
surface: agent
model: claude-sonnet-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: (direct request) final fixes from the owner's review, then PR
labels: ["demo","activity","staff","slip-pdf","booking-reference","tests"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/4
files:
 - backend/app/demo/generator.py
 - backend/app/demo/demo_source.py
 - backend/app/demo/names.py
 - backend/app/demo/export_fixture.py
 - backend/app/booking/reference.py
 - backend/app/command_centre/source.py
 - backend/app/command_centre/real_source.py
 - backend/app/routers/admin_dashboard.py
 - backend/app/routers/admin_staff.py
 - backend/tests/unit/test_demo_generator.py
 - backend/tests/unit/test_reference.py
 - frontend/src/lib/booking/slip.ts
 - frontend/src/admin/state/demoSimulation.ts
 - frontend/tests/mock-api/booking.mjs
 - frontend/tests/mock-api/admin-bookings.mjs
 - frontend/tests/fixtures/admin/demo-day.json
 - frontend/tests/unit/booking-slip.test.ts
 - frontend/tests/unit/booking-reference.test.ts
 - frontend/tests/unit/admin-fixture-parity.test.ts
 - frontend/tests/unit/mock-api.test.ts
tests:
 - backend/tests/unit/test_demo_generator.py
 - backend/tests/unit/test_reference.py
 - frontend/tests/unit/booking-slip.test.ts
 - frontend/tests/unit/admin-fixture-parity.test.ts
---

## Prompt

Feature 006 (branch 006-clinic-command-centre). Final fixes from the owner's review, then PR.
1. Demo Activity must be coherent with the demo day: status events timed from each booking's own appointment (arrived 5-15 min before its slot, completed after the slot ends, no-show after the slot), never before clinic opening, never in the future, and continuing through the day up to "now" (or 12:30 in the typical-day mode). Example bug: booking D7GYPZTXF5 (10:15 appointment) shows "Completed" at 08:51.
2. Demo Staff "last sign-in" must equal each person's latest "Signed in" event in Activity (today Sana Malik signs in at 09:51 in Activity but Staff shows Sun 4 Oct; same for Hina and Omar). Every staff member who acts today must have signed in today before acting.
3. Add tests that check this coherence (no event before its booking's slot logic, no event before opening, staff last sign-in matches Activity).
4. Slip PDF: the watermark now sits bottom-right behind the QR code, half cut off. Centre it behind the visit details at the same light opacity as the web slip, or remove it from the PDF; it must never overlap the QR or text.
5. Booking reference alphabet: new references must avoid look-alike characters (0/O, 1/I/L) e.g. Crockford-style; existing references stay valid and look-ups stay case-insensitive. Add a test.
Then run all suites sequentially (pytest alone, Playwright main + admin alone, Vitest), single clean runs, lint/types clean, regenerate only intended baselines with a pixel-diff report. Commit + push, then create the PR to main with gh (do NOT merge). STOP with a short report and the PR link.

## Response

- Demo bookings now carry their own `arrived_at` (5-15 min before the slot, never before 09:03) and `closed_at` (1-10 min after the slot ends), derived from the reference so the dataset's random stream is unchanged. `status_at` uses them, and a demo no-show stays confirmed until it is marked.
- The activity feed is built from those instants: every non-cancelled visit of the last week has its arrived/completed/no-show events, and nobody acts before signing in that day (first person at 09:00-09:02, the rest within 40 min). The demo route filters the feed by the viewer's own "now".
- Staff last sign-in is the latest "Signed in" event by that clock (`DemoSource.staff(now)`), so the two cannot disagree; every person also has an earlier-day sign-in.
- Slip PDF watermark: 140 pt, centred on the visit-details band, same 4 % opacity; a test asserts it stays inside that band and clear of the QR.
- New references (backend, mock API, simulated bookings, demo) draw from a 30-character set without 0/O/1/I/L/U; parsing still accepts the full Crockford set, so old references stay valid.

## Outcome

Final single-suite runs (one at a time, foreground/background-awaited, 2026-10-08):

- Backend pytest: 1042 passed, 1 skipped (`time.tzset` unavailable on Windows), 4 deselected (22m30s).
- Vitest (incl. admin-fixture-parity): 102 files, 1366 tests passed.
- admin-visual (no snapshot update): 76 passed, 4 skipped.
- Playwright main (all projects): 1905 passed, 202 skipped, 0 failed (16.2m). Next dev logged `NoFallbackError` on a few not-found routes; no test failed.
- Baselines: 60 admin-visual PNGs regenerated. Pixel diff vs HEAD (channel delta > 8): max 4.33% (Activity, 1280 laptop), Bookings drawer/confirm 1-2.3%, Overview/Bookings 0.2-0.45%, Insights ~0.06%. No size changes.
