---
id: 001
title: Specify appointment booking
stage: spec
date: 2026-10-04
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.specify
labels: ["spec", "booking", "slots", "schedules", "concurrency", "idempotency", "privacy", "rate-limiting"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/005-appointment-booking/spec.md
 - specs/005-appointment-booking/checklists/requirements.md
tests:
 - none (specification stage)
---

## Prompt

/sp.specify Feature 005: Doctor schedules, available time slots and online appointment booking (demo-ready).

Goal: a visitor can pick a department or doctor, see real available time slots, and book an appointment in under a minute, with zero chance of double-booking.

Requirements:
- Doctor weekly schedules (days, start/end, slot length, breaks) stored in the database; doctor leave/holidays and clinic holidays block slots. All times in the clinic time zone (Asia/Karachi) from clinic settings.
- Slots API: available slots per doctor for the next N days (configurable), hides past times, a minimum lead time, booked slots, leave and holidays.
- Booking: patient name, Pakistani mobile number (validated), optional email, reason (optional), and must accept the clinic rules. No login yet (OTP comes in Feature 007).
- No double-booking guaranteed by the database (constraint), not just app code; a concurrency test proves two simultaneous bookings for the same slot give exactly one success. The loser gets a friendly "this slot was just taken" message with the next free slots.
- Idempotency: a double click or retry never creates two bookings.
- Confirmation page with a booking reference (not guessable) and the details; patient data is never shown in URLs or logs.
- Abuse protection: rate limits per IP and per phone number, honeypot field, max active bookings per phone.
- Frontend: Book Appointment flow (department > doctor > date > time > details > confirm) using the existing premium design; "Book" buttons on doctor pages pre-select the doctor. Mobile-first, accessible, fast.
- Honest labels: clearly a portfolio demo; seed data only.
- Seed sample schedules for the 9 sample doctors (seed never runs in production).

Out of scope (later features): OTP login, My Appointments, cancel/reschedule by patient, SMS/email reminders, lab test booking, staff dashboards.

## Response snapshot

Created branch `005-appointment-booking` and wrote `specs/005-appointment-booking/spec.md`. The spec has 7 prioritized user stories:
- P1: book in under a minute, no double-booking, idempotent retries, slots that match real schedules, leave and holidays.
- P2: Book from a doctor page, abuse protection, privacy and honesty.

It also has edge cases, functional requirements FR-001 to FR-082, key entities, success criteria SC-001 to SC-010, constitution constraints, assumptions, dependencies and out-of-scope items. It reuses Feature 003's weekly schedule sessions; breaks are the gaps between a day's sessions. Open choices have documented defaults instead of clarification markers: 14-day window, 2 h lead time, max 3 active bookings per mobile, the rate-limit values, status "confirmed", and masked details when a booking is looked up by reference. The quality checklist passes.

## Outcome

- ✅ Impact: Feature 005 spec ready for /sp.clarify or /sp.plan
- 🧪 Tests: none (specification stage)
- 📁 Files: spec.md, checklists/requirements.md
- 🔁 Next prompts: /sp.clarify (optional: revisit defaults) then /sp.plan
- 🧠 Reflection: The create-new-feature script created the branch and spec, then printed a positional-parameter error. The outputs were checked by hand.

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 printed a ParameterBindingException after creating the branch and spec file
- Graders run and results (PASS/FAIL): spec quality checklist PASS (iteration 1)
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): pass the feature description through a file or a single-line argument to avoid the binding error
