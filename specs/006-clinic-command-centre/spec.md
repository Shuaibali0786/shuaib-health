# Feature Specification: Clinic Command Centre — Staff Dashboard and Public One-Click Demo

**Feature Branch**: `006-clinic-command-centre`
**Created**: 2026-10-05
**Status**: Draft
**Input**: User description: "Feature 006: Clinic Command Centre — a luxury admin dashboard for Shuaib Health, plus a public one-click demo of it. GOAL: When a clinic owner or client opens it, they are impressed immediately: it must feel like a premium UK private clinic (Harley Street level) — calm, elegant, fast, fully in control. Same brand as the website: navy, teal, gold, serif headings, generous spacing, subtle motion. Mobile-first (most users are on phones). USERS / ACCESS — Admin (owner): full access. Receptionist: day-to-day bookings, no admin settings. Demo viewer: read-only. Real access at /admin/login only. No public sign-up. Passwords hashed (Argon2), secure httpOnly session cookie, session expiry, login rate-limit + lockout, CSRF protection. First admin created by a CLI command, never by seed with a default password, never in production by seed. Every request is authorised on the server (not only hidden in the UI). Audit log for logins, status changes and "reveal phone". PUBLIC DEMO — A "View Demo Dashboard" button (on the website footer/About page and at /admin/login) opens the dashboard instantly with no password. Demo uses only synthetic sample data, generated relative to today (Karachi time) so it always looks fresh and busy. Demo data never mixes with real bookings. Visitors can click everything (change status, filters, charts) so it feels real, but nothing is saved on the server; a clear elegant "Demo mode — changes are not saved" ribbon; it resets on reload. Server enforces demo = read-only. SCREENS — 1. Overview: KPI cards with trend vs last week (today's appointments, arrived, completed, no-shows, cancellations, chair utilisation %); today's agenda timeline by doctor; next patients up. 2. Bookings: search (reference, name), filters (date range, doctor, department, status), pagination; a detail drawer; status flow Confirmed → Arrived → Completed / No-show / Cancelled with confirm + undo. Phone masked by default; "reveal" is logged. 3. Insights: bookings per day (7/30/90 days), by department, status breakdown, busiest hours. 4. Doctors today: who is in, booked vs free slots, utilisation. 5. Activity: audit log feed (admin only). Mobile: bottom navigation, cards instead of table rows, sticky filters. Skeleton loading, beautiful empty states, light + dark (navy night) mode. WCAG 2.2 AA, full keyboard use. QUALITY / SAFETY — Dashboard JS must never load on public pages (code-split); public pages' Lighthouse must not get worse. "Today" always means Asia/Karachi. No personal data in logs or URLs. Fake data only in tests/demo. Tests: API auth tests (every endpoint rejects no session; demo cannot write; receptionist cannot do admin-only), unit, Playwright desktop + mobile, visual baselines, accessibility checks. DESIGN GATE (important): after the plan and before writing feature code, build a static design preview (Overview + Bookings, desktop and mobile, with demo data) and STOP so Shuaib can approve the look. OUT OF SCOPE (later features): OTP / My Appointments, reminders, lab booking, report PDFs, doctor's own dashboard, editing white-label settings, CSV export."

## Context

Features 001–005 built the public website, the catalog of departments and doctors, and online booking: patients can book a real slot and receive a booking reference, but nobody at the clinic can yet see or manage those bookings. This feature gives clinic staff a private, premium "Command Centre" to run the day (who is coming, who has arrived, who is next, how busy each doctor is) and gives prospective clients a one-click, no-password demo of the same experience filled with realistic, always-fresh sample data.

The Command Centre is a showcase as much as a tool: the first impression must be "this is a premium private clinic that is fully in control". It uses the same brand as the public website (navy, teal and gold; serif headings; generous spacing; subtle motion) and is designed for phones first.

## Clarifications

### Session 2026-10-05

- Q: Include an Admin-only staff-account screen, or create staff only via the server command? → A: Keep the Admin-only staff-account screen (create, reset password, deactivate) (FR-004).
- Q: May Receptionists reveal patient phone numbers? → A: Yes; every reveal is audited (FR-002, FR-027).
- Q: Keep the other defaults (10 s undo; 5 failures in 15 min → 15 min lock; 30 min idle / 12 h absolute session; deterministic per-day demo data)? → A: Yes, keep all.
- Q: How do audit retention and Feature 005's demo-mode retention fit together? → A (industry standard, chosen by agent): retention is per-deployment configuration. In demo mode (the portfolio deployment) Feature 005's rules apply — bookings and their status history are deleted 7 days after the appointment, audit events after 90 days. Outside demo mode, audit events are kept at least 1 year (FR-031).
- Q: Is the Feature 006 audit log a new log or Feature 005's? → A (agent): one audit log, extending Feature 005's with staff actors and the new event types (Key Entities).
- Q: How does an Admin reset a staff password? → A (agent): the Admin sets a temporary password; the staff member must change it at next sign-in; all that person's sessions end immediately (FR-004).
- Q: May a staff member be signed in on several devices? → A (agent): yes, up to 3 active sessions; the oldest is ended when a 4th starts; changing password or deactivation ends all of them (FR-006).
- Q: How long does a revealed phone stay visible? → A (agent): until the drawer/card is closed or 60 seconds pass, whichever is first; then it is masked again (FR-027).
- Q: How long does a demo session last? → A (agent): 2 hours, then a fresh demo starts on the next click; demo sessions never touch staff sessions (FR-013).
- Q: What scale and reliability targets apply? → A (agent): one clinic, ≤ 20 staff, ≤ 300 bookings/day, ≤ 30,000 bookings in 90 days; dashboard failures must never affect public booking (Non-Functional section).
- Q: What canonical terms are used? → A (agent): "Booking" is the record; "appointment" is its time slot; statuses are Confirmed, Arrived, Completed, No-show, Cancelled; "Staff" = Admin or Receptionist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-click public demo (Priority: P1)

A prospective client (or anyone curious) presses "View Demo Dashboard" on the website footer, the About page or the staff sign-in page. With no password, the Command Centre opens immediately, full of realistic sample appointments for today and recent weeks. They can explore every screen, use filters and charts, open bookings and even move a booking through its status steps — it all responds as if real. An elegant ribbon makes clear: "Demo mode — changes are not saved". Reloading the page restores the original sample day.

**Why this priority**: The demo is the main way the product is shown to clients; it is visible to the public and must impress in the first few seconds. It also has the highest safety stakes (an anonymous visitor must never see or change real data).

**Independent Test**: From the public website, press "View Demo Dashboard"; the Overview shows today's (Karachi) sample data within seconds; change a booking status; reload; the change is gone; and every attempt by the demo session to write to the server is refused by the server.

**Acceptance Scenarios**:

1. **Given** a visitor on the website footer, the About page or the sign-in page, **When** they press "View Demo Dashboard", **Then** the Command Centre Overview opens without any password prompt, showing sample data dated relative to today in clinic time.
2. **Given** the demo is open on any screen, **When** the visitor looks at the page, **Then** a clear, elegant "Demo mode — changes are not saved" ribbon is always visible and does not hide content or controls.
3. **Given** the demo, **When** the visitor changes a booking's status, applies filters, switches chart ranges or reveals a phone number, **Then** the interface responds exactly as it would for staff, but the change exists only in that browser view.
4. **Given** changes made in the demo, **When** the visitor reloads the page, **Then** the demo returns to its original sample state.
5. **Given** a demo session, **When** any request that would create, change or delete data reaches the server (including a hand-crafted request), **Then** the server refuses it and nothing is stored.
6. **Given** a demo session, **When** it requests data, **Then** it only ever receives synthetic sample data — never a real booking, real patient name or real phone number — and real staff never see demo data.
7. **Given** the demo is opened on different days, **When** the Overview loads, **Then** "today" always has a believable busy day (appointments spread across doctors, some arrived, some completed, a few no-shows and cancellations), and trends compare to the previous week.
8. **Given** the demo, **When** the visitor tries to open the Activity screen, **Then** they see a representative sample activity feed made of synthetic events (so the feature can be shown), clearly part of the demo.

---

### User Story 2 - Secure staff sign-in and role-based access (Priority: P1)

The clinic owner (Admin) and receptionists sign in at the staff sign-in page with their own email and password. There is no public sign-up. Accounts are created by the owner; the very first Admin account is created by a command run by the operator on the server. Sessions expire, repeated wrong passwords are slowed and then locked out, and every screen and every action is checked by the server against the person's role.

**Why this priority**: Without secure access no real booking data can be shown; patient data is sensitive and the clinic's trust depends on it.

**Independent Test**: Create the first Admin with the operator command; sign in; reach every screen; sign out; confirm that every dashboard data request without a valid session is refused; confirm a Receptionist is refused admin-only actions even when crafting the request directly.

**Acceptance Scenarios**:

1. **Given** no staff accounts exist, **When** the operator runs the "create first admin" command and enters an email and a strong password, **Then** an Admin account is created; the password is never shown, logged or stored in readable form.
2. **Given** the sample-data loading routine, **When** it runs in any environment, **Then** it never creates a staff account with a known or default password, and it never runs in production.
3. **Given** valid credentials, **When** a staff member signs in, **Then** they land on the Overview; the sign-in is recorded in the audit log.
4. **Given** wrong credentials, **When** a sign-in fails, **Then** the message is the same whether the email exists or not, and the failed attempt is recorded in the audit log.
5. **Given** 5 failed sign-ins for one account within 15 minutes, **When** another attempt is made, **Then** the account is temporarily locked for 15 minutes (correct password included) with a calm message; repeated attempts from one network address are also rate limited.
6. **Given** a signed-in staff member, **When** they are inactive for 30 minutes, or 12 hours have passed since sign-in, **Then** the session ends and they must sign in again; any unsaved action is not silently lost (they are told to sign in again).
7. **Given** any dashboard data or action request, **When** it arrives without a valid session, **Then** it is refused; when it arrives from a different site or without the anti-forgery check, a state-changing request is refused.
8. **Given** a Receptionist, **When** they try to open an admin-only screen or perform an admin-only action (Activity feed, staff account management), **Then** the screen is not offered in navigation, and the server refuses the request even if crafted directly.
9. **Given** a signed-in staff member, **When** they sign out, **Then** the session ends immediately on the server and the browser can no longer use it.
10. **Given** there is no public sign-up, **When** anyone looks for a way to create an account from the website or sign-in page, **Then** none exists.

---

### User Story 3 - Overview: today at a glance (Priority: P1)

On opening the Command Centre, staff see today (clinic time) at a glance: KPI cards for today's appointments, arrived, completed, no-shows, cancellations and chair utilisation, each with a trend against the same weekday last week; an agenda timeline of today's appointments grouped by doctor; and a "Next patients up" list.

**Why this priority**: This is the first screen everyone sees — it is the "wow" moment for clients and the daily control panel for the clinic.

**Independent Test**: With a fixed "now" and fixed data, the Overview shows the exact expected KPI values, trends, agenda entries and next patients.

**Acceptance Scenarios**:

1. **Given** today's bookings, **When** the Overview loads, **Then** six KPI cards show: total appointments today (excluding cancelled), arrived, completed, no-shows, cancellations, and chair utilisation % — each with the change versus the same weekday last week (up/down arrow, value, and words for screen readers, e.g. "up 3 on last Monday").
2. **Given** chair utilisation, **When** it is calculated, **Then** it equals booked (non-cancelled) slots ÷ all scheduled slots for today across working doctors, shown as a whole percent; if no slots are scheduled it shows "—" with "No clinics today".
3. **Given** today's agenda, **When** viewed, **Then** each working doctor has a row/lane of appointments in time order with status shown by colour **and** text/icon (never colour alone), and a "now" marker at the current clinic time.
4. **Given** "Next patients up", **When** viewed, **Then** it lists the next up-to-5 confirmed (not yet arrived) appointments from now, with time, doctor, masked patient name and a one-tap "Mark arrived".
5. **Given** the clock passes midnight in Karachi, **When** the Overview is refreshed, **Then** it shows the new day; the device's own time zone never changes which day is "today".
6. **Given** a day with no bookings, **When** the Overview loads, **Then** a calm, branded empty state is shown instead of zeros and blank charts alone.

---

### User Story 4 - Bookings: find, inspect and move through status (Priority: P1)

Staff find any booking by reference or patient name, filter by date range, doctor, department and status, and page through results. Opening a booking shows a detail drawer. From there (or from the list), staff move the booking along its status flow — Confirmed → Arrived → Completed, or Confirmed/Arrived → No-show, or Confirmed → Cancelled — with a confirmation step and an Undo. Phone numbers are masked by default; revealing one is a deliberate action that is recorded.

**Why this priority**: This is the receptionist's daily work; status tracking produces the data that powers the Overview and Insights.

**Independent Test**: Search for a known reference; open the drawer; move it Confirmed → Arrived → Completed with confirmations; undo the last step; reveal the phone; verify the audit log has one entry per status change, one for the undo and one for the reveal.

**Acceptance Scenarios**:

1. **Given** the Bookings screen, **When** staff type a full or partial booking reference or patient name, **Then** matching bookings appear (search is case-insensitive and tolerates extra spaces), and search terms never appear in the page address.
2. **Given** filters for date range, doctor, department and status, **When** applied together, **Then** only bookings matching all filters are shown, results are paged (default 20 per page) with the total count, and the default view is today, all doctors, all statuses.
3. **Given** a booking row or card, **When** opened, **Then** a detail drawer shows reference, patient name, masked phone, email (if any) masked, reason, doctor, department, date and time (clinic time), fee, booked-at time, status and its history; the drawer is keyboard accessible, traps focus while open and returns focus on close.
4. **Given** the allowed status flow, **When** staff choose a next status, **Then** only valid next statuses are offered: Confirmed → Arrived, No-show, Cancelled; Arrived → Completed, No-show; Completed, No-show and Cancelled are final.
5. **Given** a status change, **When** staff choose it, **Then** a short confirmation is required (e.g. "Mark Ayesha K. as arrived for 10:30?"); on confirm the change is saved, shown at once, and an "Undo" option is offered for 10 seconds.
6. **Given** Undo is pressed within the window, **When** processed, **Then** the booking returns to its previous status and the undo is recorded in the audit log as its own event.
7. **Given** two staff change the same booking at nearly the same time, **When** the second change arrives, **Then** it is refused if the booking's status has already changed, with "This booking was just updated — showing the latest", and the latest state is shown.
8. **Given** "No-show" or "Arrived" for an appointment that has not started yet, **When** attempted, **Then** "No-show" is not offered before the appointment's start time; "Arrived" is allowed from 2 hours before start.
9. **Given** a masked phone (e.g. "0300****567"), **When** staff press "Reveal", **Then** the full number is shown for that booking only, a "Call" action becomes available on phones, and the reveal is recorded in the audit log (who, when, which booking reference — never the number itself).
10. **Given** a cancellation by staff, **When** confirmed, **Then** the slot becomes free again for public online booking.
11. **Given** no bookings match, **When** the list is empty, **Then** a branded empty state explains why ("No bookings match these filters") with a one-tap "Clear filters".

---

### User Story 5 - Mobile-first premium experience (Priority: P1)

Most staff and demo visitors use phones. On a phone the Command Centre uses a bottom navigation bar, shows bookings as cards instead of table rows, keeps filters reachable in a sticky bar, and remains elegant and calm. Loading shows skeletons, empty states are designed, and there is a light mode and a dark "navy night" mode. Everything works fully by keyboard and meets WCAG 2.2 AA.

**Why this priority**: The first impression on a phone is the product's first impression for most users.

**Independent Test**: Run the main journeys (demo open, sign in, find booking, change status, view insights) at phone and desktop widths, in light and dark mode, using only the keyboard; automated accessibility checks report no violations; visual baselines match.

**Acceptance Scenarios**:

1. **Given** a phone-width screen, **When** the Command Centre opens, **Then** navigation is a bottom bar with the main screens, touch targets are at least 44×44 px, and there is no sideways scrolling.
2. **Given** the Bookings screen on a phone, **When** results show, **Then** each booking is a card with time, masked name, doctor and status, and filters stay reachable in a sticky bar while scrolling.
3. **Given** data is loading, **When** the screen is waiting, **Then** skeleton placeholders matching the final layout are shown (no layout jump when content arrives).
4. **Given** the theme toggle, **When** staff choose light, dark ("navy night") or follow the device setting, **Then** the choice is applied everywhere, remembered on that device, and both themes meet AA contrast.
5. **Given** a keyboard-only user, **When** they use every screen, drawer, dialog, filter and chart, **Then** all actions are reachable, focus is always visible, order is logical, and charts have a text/table alternative.
6. **Given** a user who prefers reduced motion, **When** they use the dashboard, **Then** non-essential animation is removed.

---

### User Story 6 - Insights (Priority: P2)

The owner sees how the clinic is doing: bookings per day over the last 7, 30 or 90 days; bookings by department; a status breakdown (completed, no-show, cancelled, etc.); and the busiest hours of the day.

**Why this priority**: Valuable for the owner and impressive in the demo, but not needed to run the day.

**Independent Test**: With fixed data, each chart shows the exact expected totals for each range, and the text alternative lists the same numbers.

**Acceptance Scenarios**:

1. **Given** the Insights screen, **When** the range 7 / 30 / 90 days is chosen, **Then** "bookings per day" shows one value per clinic-time day (days with none show zero), ending today.
2. **Given** the same range, **When** viewed, **Then** "by department", "status breakdown" and "busiest hours" (by hour of day, clinic time) reflect exactly the bookings in that range.
3. **Given** any chart, **When** a screen-reader or keyboard user reaches it, **Then** a summary sentence and a data table alternative are available.
4. **Given** too little data in the range, **When** viewed, **Then** a calm empty state is shown instead of a misleading chart.

---

### User Story 7 - Doctors today (Priority: P2)

Staff see who is in today: each doctor scheduled today with their session times, booked versus free slots, and utilisation; doctors on leave are shown as such.

**Why this priority**: Helps reception offer walk-ins and phone bookings to doctors with free time; builds on schedule data from Feature 005.

**Independent Test**: With fixed schedules, leave and bookings, each doctor's booked count, free count and utilisation match the expected values.

**Acceptance Scenarios**:

1. **Given** today's schedules, **When** the screen loads, **Then** each doctor working today is listed with department, session times, booked slots, free slots and utilisation %, ordered by next free slot.
2. **Given** a doctor on leave today, **When** listed, **Then** they appear as "On leave" with no slot counts; doctors not scheduled today are listed separately as "Not in today" (collapsed by default).
3. **Given** a clinic holiday, **When** the screen loads, **Then** it shows "Clinic closed today" with the holiday name.

---

### User Story 8 - Activity (audit) feed (Priority: P3)

The Admin sees a chronological feed of security-relevant and operational events: sign-ins (successful and failed), lockouts, sign-outs, booking status changes and undos, and phone reveals — who, what, when — filterable by event type and staff member.

**Why this priority**: Required for accountability and privacy, but used occasionally.

**Independent Test**: Perform a sign-in, a status change, an undo and a reveal; the feed shows four matching events in order; a Receptionist cannot view the feed.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they open Activity, **Then** events show newest first with actor, action, booking reference (where relevant) and clinic-time timestamp, paged.
2. **Given** an audit entry, **When** inspected, **Then** it never contains a password, full phone number, email or reason text.
3. **Given** a Receptionist or a demo session asking for real audit data, **When** the request reaches the server, **Then** it is refused.
4. **Given** audit entries, **When** anyone tries to edit or delete them through the dashboard, **Then** no such action exists.

---

### Edge Cases

- **Session expires mid-action**: the action is refused, the user is told to sign in again, and after signing in they return to the screen they were on (without patient data in the address).
- **Account locked while user is unaware**: message says "Too many attempts — try again in 15 minutes"; does not reveal whether the email exists.
- **Admin deactivates a staff account while that person is signed in**: their next request is refused and their session ends.
- **Last active Admin**: the system prevents deactivating or demoting the last active Admin.
- **Status change for a booking whose appointment day is in the past**: allowed (to tidy up records) for Arrived/Completed/No-show; Cancel is not offered after the appointment's start time.
- **Undo after another change**: if someone else changed the booking after you, your Undo is refused with "This booking was changed by someone else".
- **Undo window passes**: the Undo control disappears; correcting a mistake after that is not possible in this feature (final states are final) — documented as a known limit.
- **Real data retention from Feature 005**: real (portfolio-demo) bookings are deleted 7 days after their appointment time; Insights for 30/90 days therefore may look sparse for real data; the demo is unaffected.
- **Karachi day boundary**: a 23:45 appointment belongs to that Karachi date in every screen, KPI and chart, regardless of server or device time zone.
- **Demo opened just before midnight Karachi**: the sample day is generated for the Karachi date when the demo was opened; it stays consistent until reload.
- **Demo visitor crafts a write request or tries to reach real data**: refused by the server; the demo session cannot be upgraded to a staff session.
- **Many demo visitors at once**: the demo must not affect performance for real staff or the public booking flow; the demo is rate limited per network address.
- **Slow or offline network**: skeletons, then a calm "Can't reach the clinic system — retrying" message with a Retry button; no half-applied status changes.
- **Very long names / many appointments for one doctor**: names truncate gracefully with full text available; agenda lanes scroll within themselves.
- **Doctor or department later deactivated**: their past bookings still show correctly in Bookings and Insights.
- **Search with no match / special characters**: empty state; special characters are treated as plain text.

## Requirements *(mandatory)*

### Functional Requirements

**Access and roles**

- **FR-001**: The system MUST provide staff sign-in only at the staff sign-in page (`/admin/login`) using email and password; there MUST be no public sign-up anywhere.
- **FR-002**: The system MUST support three roles: **Admin** (everything), **Receptionist** (Overview, Bookings incl. status changes and reveal phone, Insights, Doctors today; no Activity feed, no staff account management) and **Demo viewer** (all screens with synthetic data, never able to write).
- **FR-003**: The first Admin MUST be created only by an operator command run on the server, which prompts for email and password; no seed, migration or sample-data routine may ever create a staff account with a default or known password, and sample data MUST never be loaded in production.
- **FR-004**: An Admin MUST be able to create Receptionist (and Admin) accounts, reset a staff member's password and deactivate accounts on a minimal Admin-only staff-account screen; no other admin settings are in scope. Staff emails are unique (case-insensitive). A reset sets a temporary password that the staff member must change at next sign-in, and ends all of that person's sessions immediately. The last active Admin cannot be deactivated or demoted.
- **FR-005**: Passwords MUST be stored only as strong, salted, slow one-way hashes (Argon2 family), and MUST be at least 12 characters and not on a common-password list.
- **FR-006**: Sessions MUST use a secure, httpOnly, same-site cookie; MUST expire after 30 minutes of inactivity and 12 hours absolute; MUST be ended on the server at sign-out; and MUST be renewed on sign-in (no session fixation). A staff member may have at most 3 active sessions (the oldest ends when a 4th starts); a password change or deactivation ends all of them.
- **FR-007**: Sign-in MUST be rate limited per network address and per account; after 5 failed attempts in 15 minutes the account MUST be locked for 15 minutes; failure messages MUST NOT reveal whether an account exists.
- **FR-008**: All state-changing requests MUST be protected against cross-site request forgery.
- **FR-009**: Every dashboard data and action request MUST be authorised on the server by session and role; hiding a control in the interface is never the only protection.

**Public demo**

- **FR-010**: A "View Demo Dashboard" button MUST appear in the public website footer, on the About page and on the staff sign-in page, and MUST open the Command Centre in demo mode with no password.
- **FR-011**: Demo mode MUST use only synthetic sample data, generated relative to today's Karachi date, giving a believable busy clinic (realistic spread across doctors, statuses and hours) for today, the past 90 days and the next 14 days, with week-on-week trends.
- **FR-012**: Demo data MUST be fully separate from real bookings: the demo never receives real data and real staff screens never include demo data.
- **FR-013**: In demo mode, every interaction (status changes with confirm and undo, filters, search, reveal phone, theme, charts) MUST work in the visitor's browser only; nothing is saved on the server and reloading MUST restore the original sample state. A demo session lasts 2 hours; after that the next click starts a fresh demo. Demo sessions are entirely separate from staff sessions.
- **FR-014**: The server MUST refuse every write request from a demo session.
- **FR-015**: A clear, elegant "Demo mode — changes are not saved" ribbon MUST be visible on every demo screen, with a link to the public website and (where relevant) to staff sign-in.
- **FR-016**: Demo entry MUST be rate limited per network address so heavy demo use cannot degrade real staff use or public booking.

**Overview**

- **FR-017**: The Overview MUST show KPI cards for today (Karachi): appointments (non-cancelled), arrived, completed, no-shows, cancellations and chair utilisation %, each with the change vs the same weekday last week.
- **FR-018**: Chair utilisation MUST be calculated as booked non-cancelled slots ÷ all scheduled slots for working doctors today (excluding leave and holidays).
- **FR-019**: The Overview MUST show today's agenda grouped by doctor in time order with a current-time marker, and a "Next patients up" list of the next 5 confirmed appointments with a one-tap "Mark arrived".

**Bookings**

- **FR-020**: Staff MUST be able to search bookings by full or partial reference and patient name, and filter by date range, doctor, department and status, with paged results (20 per page) and a total count.
- **FR-021**: Search terms and filters that could contain personal data MUST NOT appear in page addresses; non-personal filters (dates, doctor, department, status, page) MAY appear so views can be bookmarked.
- **FR-022**: A booking detail drawer MUST show the booking's details and its status history.
- **FR-023**: The booking status set MUST be: Confirmed, Arrived, Completed, No-show, Cancelled; allowed changes MUST be exactly Confirmed→Arrived, Confirmed→No-show, Confirmed→Cancelled, Arrived→Completed, Arrived→No-show; the server MUST reject any other change.
- **FR-024**: "Arrived" MUST be allowed only from 2 hours before the appointment start; "No-show" only after the appointment start; staff "Cancelled" only before the appointment start.
- **FR-025**: Every status change MUST require a confirmation step and MUST offer an Undo for 10 seconds that restores the previous status; status changes MUST be refused if the booking changed since the user last saw it.
- **FR-026**: Cancelling a booking MUST free its slot for public online booking.
- **FR-027**: Patient phone numbers and emails MUST be masked by default in every list, card and drawer. Admins and Receptionists may "Reveal" the full phone for one booking; every reveal MUST create an audit entry. A revealed phone is masked again when the drawer/card closes or after 60 seconds, whichever comes first.

**Insights and Doctors today**

- **FR-028**: Insights MUST show bookings per day for 7 / 30 / 90 days, bookings by department, status breakdown and busiest hours (clinic time), each with a text summary and data-table alternative.
- **FR-029**: Doctors today MUST list doctors working today with session times, booked and free slots and utilisation; doctors on leave and not working are shown separately; clinic holidays show "Clinic closed today".

**Audit**

- **FR-030**: The system MUST record audit events for: sign-in success, sign-in failure, lockout, sign-out, session expiry, status change, undo, phone reveal, and staff account changes — with actor, role, action, booking reference (if any), time and network address — and MUST NOT record passwords, full phone numbers, emails, names or reasons.
- **FR-031**: The Activity feed MUST be visible to Admins only, newest first, filterable by event type and staff member, paged; audit entries cannot be edited or deleted from the dashboard. Retention is per-deployment configuration: in demo mode (the portfolio deployment) audit events are purged after 90 days, matching Feature 005; otherwise they are kept for at least 1 year.

**Experience, quality and privacy**

- **FR-032**: The Command Centre MUST use the website's brand (navy, teal, gold; serif headings; generous spacing; subtle motion) with light and dark ("navy night") themes; and MUST be mobile-first with bottom navigation, booking cards and sticky filters on phones.
- **FR-033**: Every screen MUST have skeleton loading states, designed empty states and calm error states with Retry.
- **FR-034**: The Command Centre MUST meet WCAG 2.2 AA, be fully usable by keyboard, never convey status by colour alone, and respect reduced-motion preference.
- **FR-035**: "Today", day boundaries, KPIs, charts and all displayed times MUST use the clinic time zone (Asia/Karachi), labelled as clinic time.
- **FR-036**: Dashboard code and assets MUST NOT load on any public page; the public pages' performance, accessibility, best-practice and SEO scores MUST NOT decrease.
- **FR-037**: Personal data (names, phones, emails, reasons, search terms) MUST NOT appear in logs, error reports or page addresses; dashboard pages MUST not be indexed by search engines nor cached by shared caches.
- **FR-038**: Only fake/synthetic data may be used in tests, previews and the demo.

**Delivery gate**

- **FR-039**: After planning and before any feature code, a static design preview of Overview and Bookings (desktop and mobile, light and dark, with demo data) MUST be produced, and work MUST stop until the owner (Shuaib) approves the look.

### Non-Functional Requirements

- **NFR-001 (Scale)**: Designed for one clinic, up to 20 staff, up to 300 bookings per day and 30,000 bookings in a 90-day Insights range; Bookings search and every Insights range answer within 1 second at that volume.
- **NFR-002 (Isolation)**: A dashboard or demo failure or overload MUST NOT affect the public website or public booking.
- **NFR-003 (Observability)**: Structured logs for every dashboard request (route, role, outcome, duration, request id) with no patient personal data; counts of sign-in failures, lockouts, refused requests and demo starts are available to the operator.
- **NFR-004 (Reliability)**: A status change is either fully saved (booking, status history and audit event together) or not at all.

### Key Entities *(include if feature involves data)*

- **Staff Account**: a person who can sign in — email, display name, role (Admin / Receptionist), active flag, password hash, must-change-password flag, failed-attempt count and lock-until time, created/last-sign-in times.
- **Staff Session**: a signed-in period for one staff account — created time, last activity, absolute expiry, ended time; never holds patient data.
- **Demo Session**: an anonymous, read-only viewing session with its own synthetic dataset scope; cannot be upgraded to a staff session.
- **Appointment (Booking)** *(from Feature 005, extended)*: gains the statuses Arrived and No-show and a version so concurrent changes can be detected.
- **Status Change**: one step in a booking's history — from status, to status, who, when, and whether it was an undo.
- **Audit Event**: an append-only record of a security or operational action — actor, role, action type, booking reference (optional), time, network address; no patient personal data. This is Feature 005's audit log, extended with staff actors and the new event types, not a second log.
- **Demo Dataset**: synthetic doctors' days, appointments and audit events generated for a given Karachi date; never stored alongside real bookings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From pressing "View Demo Dashboard", the Overview is fully readable within 2.5 seconds on a mid-range phone over a typical 4G connection, and within 1.5 seconds on desktop broadband.
- **SC-002**: In informal review with at least 3 viewers (including the owner), every viewer describes the demo as "premium/professional" and can find today's next patient and mark them arrived within 30 seconds without help.
- **SC-003**: A receptionist can find any booking by reference or name and change its status in under 15 seconds on a phone.
- **SC-004**: 100% of dashboard data and action endpoints refuse requests with no session; 100% of write endpoints refuse demo sessions; 100% of admin-only endpoints refuse Receptionists — each proven by automated tests.
- **SC-005**: Zero real patient records ever appear in the demo, and zero demo records appear in staff views, verified by automated tests.
- **SC-006**: Automated accessibility checks report zero WCAG 2.2 AA violations on every screen in light and dark themes at phone and desktop widths, and every journey is completed by keyboard only.
- **SC-007**: Public pages' quality scores (performance, accessibility, best practices, SEO) are equal to or better than before this feature, and no dashboard code is downloaded on any public page.
- **SC-008**: Zero personal data (names, phones, emails, reasons, passwords) found in application logs or page addresses after running the full automated test suite.
- **SC-009**: KPI, agenda, Insights and Doctors-today numbers exactly match expected values for fixed test data, including bookings at 23:45 Karachi time.
- **SC-010**: Visual baselines for Overview and Bookings (phone and desktop, light and dark) are approved by the owner at the design gate and remain matched at release.

## Assumptions

- Real staff accounts are few (a single clinic, under 20 staff); no multi-clinic or multi-tenant support.
- Booking statuses from Feature 005 (confirmed, cancelled, completed) are extended with Arrived and No-show; existing confirmed bookings remain valid.
- The undo window is 10 seconds; lockout is 5 failures in 15 minutes for 15 minutes; idle timeout 30 minutes, absolute 12 hours — industry-standard defaults, configurable by the operator.
- Receptionists may reveal phone numbers (needed to call patients); every reveal is audited.
- A minimal Admin-only staff-account screen (create, reset password, deactivate) is included so Receptionists can exist; all other admin settings remain out of scope.
- Demo data is generated deterministically for each Karachi date, so two visitors on the same day see the same sample clinic.
- The demo Activity feed shows synthetic events so the feature can be shown; real audit data is never exposed.
- Audit retention follows the deployment mode: 90 days in demo mode (as in Feature 005), at least 1 year otherwise.
- English only, as on the public website.

## Dependencies

- Feature 005 bookings, doctor schedules, leave and clinic holidays (source of real bookings and slot counts).
- Features 001–002 public website (footer, About page) for the demo entry buttons and brand tokens.
- Operator access to the server to run the "create first admin" command.

## Out of Scope

- OTP sign-in for patients and "My Appointments".
- SMS / email reminders.
- Lab test booking and report PDFs.
- A doctor's own dashboard.
- Editing white-label or clinic settings.
- CSV / data export.
- Staff two-factor authentication, password reset by email, and rescheduling bookings from the dashboard.
