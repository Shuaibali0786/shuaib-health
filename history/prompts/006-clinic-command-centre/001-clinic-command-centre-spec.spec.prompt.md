---
id: 001
title: Clinic Command Centre spec
stage: spec
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.specify
labels: ["dashboard","admin","demo","auth","rbac","audit","accessibility"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/006-clinic-command-centre/spec.md
 - specs/006-clinic-command-centre/checklists/requirements.md
tests:
 - none (spec stage)
---

## Prompt

//sp.specify Feature 006: Clinic Command Centre — a luxury admin dashboard for Shuaib Health, plus a public one-click demo of it.

GOAL: When a clinic owner or client opens it, they are impressed immediately: it must feel like a premium UK private clinic (Harley Street level) — calm, elegant, fast, fully in control. Same brand as the website: navy, teal, gold, serif headings, generous spacing, subtle motion. Mobile-first (most users are on phones).

USERS / ACCESS
- Admin (owner): full access. Receptionist: day-to-day bookings, no admin settings. Demo viewer: read-only.
- Real access at /admin/login only. No public sign-up. Passwords hashed (Argon2), secure httpOnly session cookie, session expiry, login rate-limit + lockout, CSRF protection. First admin created by a CLI command, never by seed with a default password, never in production by seed.
- Every request is authorised on the server (not only hidden in the UI). Audit log for logins, status changes and "reveal phone".

PUBLIC DEMO
- A "View Demo Dashboard" button (on the website footer/About page and at /admin/login) opens the dashboard instantly with no password.
- Demo uses only synthetic sample data, generated relative to today (Karachi time) so it always looks fresh and busy. Demo data never mixes with real bookings.
- Visitors can click everything (change status, filters, charts) so it feels real, but nothing is saved on the server; a clear elegant "Demo mode — changes are not saved" ribbon; it resets on reload. Server enforces demo = read-only.

SCREENS
1. Overview: KPI cards with trend vs last week (today's appointments, arrived, completed, no-shows, cancellations, chair utilisation %); today's agenda timeline by doctor; next patients up.
2. Bookings: search (reference, name), filters (date range, doctor, department, status), pagination; a detail drawer; status flow Confirmed → Arrived → Completed / No-show / Cancelled with confirm + undo. Phone masked by default; "reveal" is logged.
3. Insights: bookings per day (7/30/90 days), by department, status breakdown, busiest hours.
4. Doctors today: who is in, booked vs free slots, utilisation.
5. Activity: audit log feed (admin only).
- Mobile: bottom navigation, cards instead of table rows, sticky filters. Skeleton loading, beautiful empty states, light + dark (navy night) mode. WCAG 2.2 AA, full keyboard use.

QUALITY / SAFETY
- Dashboard JS must never load on public pages (code-split); public pages' Lighthouse must not get worse.
- "Today" always means Asia/Karachi.
- No personal data in logs or URLs. Fake data only in tests/demo.
- Tests: API auth tests (every endpoint rejects no session; demo cannot write; receptionist cannot do admin-only), unit, Playwright desktop + mobile, visual baselines, accessibility checks.

DESIGN GATE (important): after the plan and before writing feature code, build a static design preview (Overview + Bookings, desktop and mobile, with demo data) and STOP so Shuaib can approve the look.

OUT OF SCOPE (later features): OTP / My Appointments, reminders, lab booking, report PDFs, doctor's own dashboard, editing white-label settings, CSV export.

Only write the spec now, then STOP and give me a short summary.

## Response snapshot

Created branch `006-clinic-command-centre` and wrote `specs/006-clinic-command-centre/spec.md`: 8 prioritised user stories (P1: one-click demo, secure sign-in/roles, Overview, Bookings status flow, mobile-first premium UX; P2: Insights, Doctors today; P3: Activity feed), edge cases, 39 functional requirements (incl. exact status transition rules, time guards, 10 s undo, optimistic-concurrency refusal, masked phone + audited reveal, demo isolation and server-side read-only, design gate FR-039), key entities, 10 measurable success criteria, assumptions, dependencies and out-of-scope. Quality checklist all passing; no clarification markers. Stopped before planning.

## Outcome

- ✅ Impact: Feature 006 specification ready for /sp.clarify or /sp.plan
- 🧪 Tests: none (spec stage)
- 📁 Files: spec.md, checklists/requirements.md
- 🔁 Next prompts: /sp.clarify (receptionist reveal, staff-account screen) or /sp.plan, then design-preview gate
- 🧠 Reflection: Added a minimal Admin staff-account screen so Receptionist role is usable; flagged as clarification candidate.

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 created branch and spec but printed a parameter-binding error (no JSON output).
- Graders run and results (PASS/FAIL): spec quality checklist PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): pass the description via -FeatureDescription to avoid positional binding errors.
