# Feature Specification: Doctor Schedules, Available Time Slots and Online Appointment Booking

**Feature Branch**: `005-appointment-booking`
**Created**: 2026-10-04
**Status**: Draft
**Input**: User description: "Feature 005: Doctor schedules, available time slots and online appointment booking (demo-ready). Goal: a visitor can pick a department or doctor, see real available time slots, and book an appointment in under a minute, with zero chance of double-booking. Requirements: Doctor weekly schedules (days, start/end, slot length, breaks) stored in the database; doctor leave/holidays and clinic holidays block slots. All times in the clinic time zone (Asia/Karachi) from clinic settings. Slots API: available slots per doctor for the next N days (configurable), hides past times, a minimum lead time, booked slots, leave and holidays. Booking: patient name, Pakistani mobile number (validated), optional email, reason (optional), and must accept the clinic rules. No login yet (OTP comes in Feature 007). No double-booking guaranteed by the database (constraint), not just app code; a concurrency test proves two simultaneous bookings for the same slot give exactly one success. The loser gets a friendly 'this slot was just taken' message with the next free slots. Idempotency: a double click or retry never creates two bookings. Confirmation page with a booking reference (not guessable) and the details; patient data is never shown in URLs or logs. Abuse protection: rate limits per IP and per phone number, honeypot field, max active bookings per phone. Frontend: Book Appointment flow (department > doctor > date > time > details > confirm) using the existing premium design; 'Book' buttons on doctor pages pre-select the doctor. Mobile-first, accessible, fast. Honest labels: clearly a portfolio demo; seed data only. Seed sample schedules for the 9 sample doctors (seed never runs in production). Out of scope (later features): OTP login, My Appointments, cancel/reschedule by patient, SMS/email reminders, lab test booking, staff dashboards."

## Overview

Features 001–004 built the public website and a read-only catalog service, and connected them. The Book Appointment page is still a "Booking coming soon" holding page. This feature makes booking real for the portfolio demo: the clinic's doctor schedules, doctor leave and clinic holidays decide which time slots exist; the visitor picks a slot and books it without an account; and the system guarantees that no slot can ever be booked twice, even when two people press "Book" at the same moment.

## Clarifications

### Session 2026-10-04 (from `/sp.plan` input)

- Q: What does the confirmation page show? → A: Only masked patient details (e.g. "A**** K****", "0300****567") plus doctor, date and time, both right after booking and later.
- Q: Where do rate-limit counters live? → A: In the shared database, so every backend instance sees the same counts (no separate cache service).
- Q: How are times stored? → A: In UTC, shown in the clinic time zone.
- Q: How long are demo bookings kept? → A: They are deleted automatically 7 days after the appointment time (FR-054).
- Q: What happens if the shared secret is not configured? → A: The service refuses to start, with a clear error (FR-055).
- Q: What does the booking form say about personal data? → A: "Demo site: please don't enter real medical details" (FR-074).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Book an appointment in under a minute (Priority: P1)

A visitor opens Book Appointment, chooses a department, then a doctor in that department, then a date, then a free time. They enter their name and Pakistani mobile number (optionally email and a short reason), tick that they accept the clinic rules, and confirm. They land on a confirmation page showing a booking reference and the appointment details.

**Why this priority**: This is the whole point of the feature; without it nothing else delivers value.

**Independent Test**: With seeded schedules and an empty bookings table, complete the flow end to end on a mobile-sized screen and see the confirmation; the booked time no longer appears as available for that doctor.

**Acceptance Scenarios**:

1. **Given** the seeded sample doctors and schedules, **When** a visitor opens Book Appointment, **Then** they see the active departments, and after choosing one, only that department's active doctors (with specialty, fee in PKR and a "Sample" label).
2. **Given** a chosen doctor, **When** the visitor views dates, **Then** they see the next N days (default 14) with days that have at least one free slot selectable and days with none shown as unavailable (not hidden), with the reason where known ("Not available", "Clinic closed").
3. **Given** a chosen date, **When** the visitor views times, **Then** only free slots are shown, grouped by part of day (morning / afternoon / evening), in clinic time (Asia/Karachi) and labelled as such.
4. **Given** a chosen slot, **When** the visitor submits valid details and has accepted the clinic rules, **Then** a booking is created, they see a confirmation page with a booking reference, doctor, department, date, time (clinic time), fee, clinic address and phone, and the clinic rules ("Before your visit").
5. **Given** a successful booking, **When** anyone requests that doctor's slots again, **Then** the booked slot is no longer offered.
6. **Given** a visitor who has not ticked the rules checkbox, **When** they try to confirm, **Then** the booking is not sent and the checkbox shows a clear, accessible error.
7. **Given** a visitor at any step, **When** they press Back (on-screen or browser), **Then** they return to the previous step with their earlier choices kept.

---

### User Story 2 - No double-booking, ever (Priority: P1)

Two visitors (or one visitor in two tabs) try to book the same doctor at the same time slot at the same moment. Exactly one booking succeeds. The other visitor sees a friendly "Sorry, this slot was just taken" message, with the next free slots for that doctor offered right there, and their typed details kept so they can rebook with one tap.

**Why this priority**: A clinic that double-books patients is worse than no online booking; the constitution (Principle III) requires this to be guaranteed by the database.

**Independent Test**: An automated test fires many simultaneous booking requests for one slot; exactly one succeeds, every other one gets the "slot taken" result, and the database holds exactly one active booking for that doctor and start time.

**Acceptance Scenarios**:

1. **Given** one free slot, **When** two (and, separately, 20) booking requests for it arrive simultaneously, **Then** exactly one succeeds and all others receive a "slot taken" response.
2. **Given** the losing visitor, **When** the "slot taken" response arrives, **Then** they see a friendly message plus up to 5 next free slots for the same doctor (same day first, then following days), and their name, mobile, email and reason are still filled in.
3. **Given** application-level checks are bypassed (e.g. a direct insert of a second active booking for the same doctor and start time), **When** the insert runs, **Then** the database itself rejects it.
4. **Given** a slot that overlaps an already-booked slot for the same doctor (e.g. after a slot length change), **When** a booking for it is attempted, **Then** it is rejected as taken.

---

### User Story 3 - Retries and double clicks are safe (Priority: P1)

A visitor double-clicks "Confirm booking", or their mobile connection drops and the browser retries. They end up with exactly one booking and see the same confirmation each time.

**Why this priority**: Duplicate bookings from flaky mobile networks are the most common real-world booking defect; it blocks their own second slot and blocks other patients.

**Independent Test**: Send the same booking request (same idempotency key) three times, including twice concurrently; exactly one booking exists and all three responses carry the same booking reference.

**Acceptance Scenarios**:

1. **Given** a visitor clicks Confirm twice quickly, **When** both clicks reach the system, **Then** one booking exists and the visitor sees one confirmation.
2. **Given** a retried request with the same idempotency key and the same details, **When** it arrives (within 24 hours), **Then** the original result is returned and no new booking is created.
3. **Given** a request reusing an idempotency key with different details, **When** it arrives, **Then** it is rejected with a clear error and nothing is created.
4. **Given** the Confirm button was pressed, **When** the request is in flight, **Then** the button is disabled and shows progress, and pressing Enter again has no effect.

---

### User Story 4 - Slots reflect real schedules, leave and holidays (Priority: P1)

The slots shown are computed by the server from each doctor's weekly schedule (days, start/end, slot length, with gaps between sessions as breaks), minus doctor leave, minus clinic holidays, minus already-booked slots, minus times in the past or within the minimum lead time — all in the clinic's time zone.

**Why this priority**: "Real available time slots" is the core promise; wrong slots mean patients arrive when the doctor is absent.

**Independent Test**: For a fixed "now" and fixed seed data (schedule with a break, one leave day, one clinic holiday, one existing booking), the slots result exactly matches the expected list.

**Acceptance Scenarios**:

1. **Given** a doctor working Mon 10:00–13:00 and 17:00–20:00 with 15-minute slots, **When** slots for a Monday are requested, **Then** slots start at 10:00, 10:15 … 12:45 and 17:00 … 19:45; nothing between 13:00 and 17:00; no slot extends past a session end.
2. **Given** a doctor on leave for a whole day (or part of a day), **When** slots are requested, **Then** no slots are offered inside the leave period.
3. **Given** a clinic holiday (whole day), **When** slots are requested for any doctor, **Then** that day has no slots and is shown as "Clinic closed".
4. **Given** the current clinic time is 11:05 and the minimum lead time is 2 hours, **When** today's slots are requested, **Then** the first slot offered is at or after 13:05.
5. **Given** the visitor's device is set to a different time zone, **When** they view and book slots, **Then** all times shown and stored are clinic time (Asia/Karachi), and the confirmation says so.
6. **Given** a request for more days ahead than the configured booking window, **When** slots are requested, **Then** only days within the window are returned.
7. **Given** a booking is submitted for a time that is not a valid free slot (not on the schedule grid, in the past, inside lead time, on leave, on a holiday, outside the window, or inactive doctor), **When** it reaches the server, **Then** it is rejected with a clear reason; client-supplied times are never trusted.

---

### User Story 5 - "Book" from a doctor's page (Priority: P2)

On a doctor's profile page, the "Book appointment" button opens the booking flow with that doctor (and their department) already selected, landing directly on date selection. On a department page, the Book buttons open the flow with that department selected. Doctor cards in lists keep linking to the profile, so the list design does not change.

**Why this priority**: Shortest path for visitors who already chose a doctor; depends on Story 1.

**Independent Test**: From a doctor's profile, press Book; the flow opens at the date step with the doctor and department shown as selected and changeable.

**Acceptance Scenarios**:

1. **Given** a doctor's profile page, **When** the visitor presses "Book appointment", **Then** the flow opens with that doctor pre-selected and shows their dates.
2. **Given** the pre-selected doctor is inactive or unknown, **When** the flow opens, **Then** it starts at department selection with a short friendly note, never an error page.
3. **Given** a pre-selected doctor, **When** the visitor wants a different one, **Then** they can go back and change department or doctor.

---

### User Story 6 - Abuse cannot flood the schedule (Priority: P2)

Bots and abusive users cannot fill a doctor's slots. Requests are rate limited per IP address and per mobile number, a hidden honeypot field catches simple bots, and one mobile number cannot hold more than a set number of upcoming active bookings.

**Why this priority**: Without login, booking is open to anyone; abuse protection keeps the demo usable and is required by the constitution (Principle II).

**Independent Test**: Automated tests exceed each limit and receive the documented "too many requests" / "limit reached" responses; a submission with the honeypot filled creates no booking.

**Acceptance Scenarios**:

1. **Given** one IP address, **When** it makes more booking attempts than allowed (default 10 per hour), **Then** further attempts are refused with a friendly "too many attempts, please try later or call the clinic" message until the window passes.
2. **Given** one mobile number, **When** it is used in more booking attempts than allowed (default 5 per fixed 24-hour window), **Then** further attempts are refused the same way.
3. **Given** a mobile number that already holds the maximum upcoming active bookings (default 3), **When** another booking is attempted, **Then** it is refused with a message explaining the limit and suggesting calling the clinic.
4. **Given** the honeypot field is filled, **When** the form is submitted, **Then** no booking is created and the response does not reveal why (looks like a generic failure to the bot), and the attempt counts toward the IP limit.
5. **Given** slot reads or booking-reference lookups, **When** one IP requests them excessively (defaults: slots 60 per minute, reference lookups 20 per minute), **Then** further requests are refused with "too many requests".

---

### User Story 7 - Privacy and honesty on every step (Priority: P2)

Patient details never appear in page addresses, browser history or logs. Every step shows that this is a portfolio demo with sample doctors, and the visitor is told not to enter real medical information.

**Why this priority**: Constitution Principles I and II; required before the feature can be shown publicly.

**Independent Test**: Complete a booking while capturing all page addresses and server logs; none contains the name, mobile, email or reason. Every booking step shows the demo notice.

**Acceptance Scenarios**:

1. **Given** a completed booking, **When** the page addresses visited during the flow are inspected, **Then** none contains name, mobile, email or reason; the confirmation address carries only the booking reference.
2. **Given** a completed booking, **When** server logs and error reports are inspected, **Then** they contain no name, mobile, email or reason values.
3. **Given** a confirmation page (right after booking or opened later by its reference), **When** it loads, **Then** it shows the doctor, date, time and status with the patient's name and mobile masked (e.g. "A**** K****", "0300****567"); it never shows the full name, full mobile, email or reason.
4. **Given** a made-up or mistyped reference, **When** it is opened, **Then** a generic "booking not found" page is shown, with the same response whether or not similar references exist.
5. **Given** any booking step, **When** it is shown, **Then** the portfolio-demo notice is visible, doctors show the "Sample" label, and the booking form (details step) shows the short notice "Demo site: please don't enter real medical details".
6. **Given** demo mode, **When** 7 days have passed after an appointment's time, **Then** that booking and its patient details are deleted automatically, and opening its reference shows the generic "booking not found" page.

---

### Edge Cases

- **Slot taken between viewing and confirming**: the visitor gets the "slot just taken" message with next free slots (Story 2), details kept.
- **Slot passes the lead time while the visitor fills the form**: booking is rejected with "this time is no longer available" and fresh slots are shown.
- **Doctor goes on leave / clinic holiday added after slots were shown**: booking for an affected slot is rejected the same way.
- **Doctor or department made inactive mid-flow**: booking rejected with a friendly message; flow returns to doctor selection.
- **Doctor with no schedule, or no free slot in the whole window**: the doctor is shown with "No online slots in the next N days — please call the clinic", with the clinic phone.
- **Department with no active doctors**: shown with the same call-the-clinic message, not hidden silently.
- **Karachi day boundary**: a slot at 23:45 clinic time belongs to that clinic date regardless of the visitor's or server's time zone; slots are never shifted by a day.
- **Session ending off the slot grid** (e.g. 10:00–12:50 with 15-minute slots): the last slot is 12:30; partial slots are not offered.
- **Overlapping leave and holiday**: the day is shown as "Clinic closed".
- **Backend asleep, slow or down**: the booking pages still render (Principle V) with a friendly "Online booking is temporarily unavailable — please call the clinic" message and the clinic phone; the visitor never sees a crash or endless spinner. If a booking request times out, the visitor is told the result is unknown and that retrying is safe (Story 3).
- **Invalid mobile formats**: accepted forms are 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX and 0092 3XXXXXXXXX with spaces or dashes; all are stored in one normalized form so limits apply to the same number however it is typed. Landlines and non-Pakistani numbers are rejected with a clear message.
- **Name with Urdu script, apostrophes or hyphens**: accepted; leading/trailing spaces trimmed; length 2–80 characters.
- **Reason text**: optional, max 300 characters; shown as plain text only (never interpreted as markup).
- **Tampered requests** (client sends a fee, status or a time off the grid): fee and status are always set by the server; off-grid times are rejected.
- **Same patient books two different doctors at the same time**: allowed (only per-doctor double-booking is prevented); the max-active-bookings limit still applies.
- **Production database**: the sample-schedule seed refuses to run against production.

## Requirements *(mandatory)*

### Functional Requirements

**Schedules, leave and holidays**

- **FR-001**: Each doctor's weekly schedule MUST be stored by the system as one or more sessions per weekday, each with start time, end time and slot length; breaks are the gaps between a day's sessions. (Feature 003 already stores sessions and slot length; this feature reuses them.)
- **FR-002**: The system MUST store doctor leave as periods (whole days or a time range on a date, with an optional internal note that is never shown publicly), and clinic holidays as dates with a public name (e.g. "Clinic closed").
- **FR-003**: All schedule, leave, holiday, slot and booking times MUST be interpreted in the clinic time zone from clinic settings (Asia/Karachi for the sample clinic); no other time zone may influence slot rules.
- **FR-004**: The system MUST seed sample weekly schedules for all 9 sample doctors (with at least one doctor having a midday break), at least one sample leave period and one sample clinic holiday within a typical booking window, all marked as sample. The seed MUST refuse to run in production.

**Available slots**

- **FR-010**: The system MUST provide, per active doctor, the available slots for each day from today through the booking window (default 14 days, configurable per clinic), in clinic time.
- **FR-011**: A slot is available only if it lies fully inside a schedule session, starts on the session's slot grid, is not in the past, starts at least the minimum lead time from now (default 2 hours, configurable), is not inside doctor leave, is not on a clinic holiday, does not overlap an active booking for that doctor, and the doctor and their department are active.
- **FR-012**: For each day in the window, the response MUST say whether the day has free slots and, if none, a public reason: "Clinic closed" (holiday), "Not available" (leave or not a working day), "Fully booked" (every slot booked), or "No times left today" (the remaining slots are in the past or inside the lead time).
- **FR-013**: Slot results MUST NOT reveal who booked a slot or any patient data, nor the internal leave note.
- **FR-014**: Slot results MUST reflect a new booking immediately for subsequent requests (no stale cache that would offer a taken slot as free).

**Booking**

- **FR-020**: A visitor MUST be able to book one slot by giving: full name (required, 2–80 characters), Pakistani mobile number (required), email (optional, valid format), reason for visit (optional, max 300 characters), and explicit acceptance of the clinic rules (required). No account or login is needed.
- **FR-021**: The mobile number MUST be validated as a Pakistani mobile number (formats listed in Edge Cases) and stored in one normalized form.
- **FR-022**: The server MUST re-validate everything at booking time: the slot is still available per FR-011, the doctor is active, and all inputs are valid. The fee and status are set by the server; any client-supplied fee, status or end time is ignored.
- **FR-023**: A new booking MUST be created with status "confirmed" and record the doctor, department, start and end time, fee at booking time (PKR), patient details, rules-acceptance time and the version of rules accepted, and creation time.
- **FR-024**: Each booking MUST get a booking reference that is short enough to read out by phone, not guessable and not sequential (at least 2^40 possible values), and unique.
- **FR-025**: Bookings, schedules, leave and holidays MUST be marked as sample data when created by the seed or the demo, so they are labelled as such wherever shown.

**No double-booking**

- **FR-030**: The system MUST make it impossible for a doctor to have two active bookings whose times overlap, enforced by the database itself so that it holds even if application checks are bypassed or race.
- **FR-031**: When a booking loses a race or targets a taken slot, the response MUST be a distinct "slot taken" result (not a generic error) that includes up to 5 next free slots for the same doctor.
- **FR-032**: An automated concurrency test MUST fire at least 20 simultaneous booking requests for one slot and assert exactly one success, all others "slot taken", and exactly one active booking stored.

**Idempotency**

- **FR-040**: Every booking request MUST carry an idempotency key generated by the browser once per booking attempt (kept across retries of that attempt).
- **FR-041**: A repeated request with the same key and same details within 24 hours MUST return the original result (same reference) without creating a new booking, including when the repeats arrive at the same time.
- **FR-042**: A request reusing a key with different details MUST be rejected with a clear error and create nothing.

**Confirmation and privacy**

- **FR-050**: After booking, the visitor MUST see a confirmation page with the booking reference, doctor, department, date and time (labelled clinic time), fee, the masked patient name and mobile (FR-051), clinic address and phone, the clinic rules, and a note that this is a demo booking.
- **FR-051**: The confirmation page address MUST contain only the booking reference. The confirmation view (both immediately after booking and when opened later by reference) MUST show only: reference, status, doctor, department, date, time, fee, the patient name masked per word (first letter + "****", e.g. "A**** K****") and the mobile masked (e.g. "0300****567"). Full name, full mobile, email and reason MUST never be returned after booking. Lookups MUST be rate limited and an unknown reference MUST give the same generic "not found" result.
- **FR-052**: Patient name, mobile, email and reason MUST NOT appear in page addresses, browser history entries, analytics events, server logs, error reports or audit-log free text.
- **FR-053**: Creating a booking MUST write an audit log entry (actor: anonymous visitor with a non-reversible client fingerprint; action: booking created; target: booking; timestamp), and so MUST refused attempts due to limits or honeypot (without patient data).
- **FR-054**: In demo mode (the default for this portfolio product), bookings MUST be deleted automatically 7 days (configurable) after the appointment time, and audit entries 90 days (configurable) after they were written. The purge MUST run without a person remembering to do it (at startup and during normal booking activity, with a command a scheduler can call), MUST NOT stop the service from starting if it fails, and MUST NOT log patient data. Outside demo mode nothing is purged automatically.
- **FR-055**: The booking service, and the website server when it starts in production, MUST refuse to start, with a clear message naming the missing setting (never its value), when the shared secret that links them is missing or too short. In local development the website only logs the error, and booking requests fail with "temporarily unavailable". The website's production build MUST still succeed without it (Principle V).
- **FR-056**: The site's own wording MUST describe the booking demo truthfully once it ships. The privacy page, terms page, FAQ, About page, Book Appointment page title and description, and department pages MUST NOT say booking is unavailable or that no personal data is collected. The privacy page MUST state:
  - what the booking form collects (name, mobile, optional email and reason) and why;
  - that bookings are deleted 7 days after the appointment time;
  - that a non-reversible network fingerprint is kept in audit records for 90 days;
  - that no messages are sent;
  - that the contact form still sends nothing.

**Confirmation slip (polish, added after Phase 4)**

- **FR-057**: The confirmation page MUST be mobile-first and help the visitor keep their slip:
  - a notice at the top: "Save this slip: tap Download or take a screenshot. Show this reference at the clinic.";
  - a large primary button "Download your slip" (brand gradient, icon, at least 48 px tall, sticky at the bottom of the screen on mobile) that makes a PDF of the masked confirmation card (clinic logo, reference, doctor, date, time, fee, clinic address and phone; patient name and mobile stay masked). On mobile with Web Share file support the PDF is shared (save to Gallery/Files, send on WhatsApp); otherwise it downloads normally;
  - secondary actions: Print, Share on WhatsApp (pre-filled with reference, doctor, date, time and clinic phone; never the patient name or mobile), Add to calendar (.ics in Pakistan time) and Book another appointment;
  - desktop: two columns (card left, actions right); mobile: card, Download, then the secondary actions;
  - the flow's step headings show a subtle focus outline only for keyboard focus (`:focus-visible`).
  No PDF, share text or calendar file may contain the full name, full mobile, email or reason (FR-051, FR-052).

**Abuse protection**

- **FR-060**: Booking attempts MUST be rate limited per client IP (default 10 per fixed one-hour window) and per normalized mobile number (default 5 per fixed 24-hour window), with counters shared by all running backend instances; booking-lookup requests MUST be rate limited per IP (default 20 per minute) the same way; slot reads fall under the general per-IP API limit (default 60 per minute). Limits MUST be configurable. Exceeding a limit gives a friendly "too many attempts" message.
- **FR-061**: The booking form MUST include a hidden honeypot field invisible to people and assistive technology; a submission with it filled MUST create no booking and get a generic response.
- **FR-062**: A normalized mobile number MUST NOT hold more than a configurable number of upcoming active bookings (default 3); further attempts are refused with an explanatory message.

**Booking flow (website)**

- **FR-070**: The Book Appointment page MUST replace the "Booking coming soon" holding page with a step-by-step flow: department → doctor → date → time → details → confirm, with a visible step indicator, Back navigation that keeps earlier choices, and the "Before your visit" rules list kept.
- **FR-071**: The "Book appointment" action on each doctor profile page MUST open the flow with that doctor pre-selected, at the date step. The Book actions on department pages MUST open the flow with that department pre-selected. Doctor cards in lists (doctors page, home page) keep linking to the profile; they get no new button.
- **FR-072**: The flow MUST use the existing premium design (colours, typography, cards, buttons, motion, tokens) and existing components where they exist; new pieces (step indicator, date picker strip, time-slot grid) MUST follow the same tokens.
- **FR-073**: The flow MUST be mobile-first and meet WCAG 2.2 AA: fully keyboard-operable, visible focus, labelled fields, errors announced and tied to their fields, slot buttons at least 24×24 px targets, step changes announced to screen readers, motion respecting reduced-motion settings.
- **FR-074**: The flow MUST show the portfolio-demo notice, "Sample" labels on doctors, and the short notice "Demo site: please don't enter real medical details" on the booking form (details step), announced to screen readers with the form.
- **FR-075**: When the booking service is unavailable or slow, the booking page MUST still render with a friendly message and the clinic phone (no crash, no endless spinner); the site build MUST NOT depend on the booking service.
- **FR-076**: The browser MUST never call the backend origin directly; all booking traffic goes through the website's same-origin path. The website MUST reject a booking request whose origin is missing or different from the site. The backend MUST accept a booking request only when it carries the server-to-server shared secret. It MUST also reject any booking request that carries a browser origin not on its allow-list.

**Contract and testing**

- **FR-080**: Slot, booking and booking-lookup operations MUST have typed request/response schemas and a documented error list (invalid input, slot taken, slot no longer available, idempotency conflict, rate limited, active-booking limit reached, not found, service unavailable), added to the committed service contract and covered by the existing contract drift check.
- **FR-081**: Unit tests MUST cover slot generation (breaks, slot grid, off-grid session ends, lead time, past times, leave whole-day and partial, holidays, existing bookings, window limit, Karachi day boundary with a different server time zone), mobile-number validation/normalization, idempotency, and every abuse limit.
- **FR-082**: An end-to-end test MUST cover browse → book (from Book Appointment and from a doctor page), the slot-taken path, and the backend-down path; accessibility checks MUST run on each step.

### Key Entities

- **Weekly schedule session** (existing): doctor, weekday, start, end, slot length. A day can have several sessions; gaps between them are breaks.
- **Doctor leave**: doctor, a period (one or more whole days, or a time range within a day), internal note (never public), sample flag.
- **Clinic holiday**: date, public name, sample flag.
- **Slot** (computed, not stored): doctor, start, end in clinic time, available or not.
- **Booking (appointment)**: reference, doctor, department, start, end, fee at booking (PKR), status (confirmed for now; cancelled/completed reserved for later features), patient name, normalized mobile, optional email, optional reason, rules accepted at + rules version, created at, sample flag. At most one active booking per doctor per overlapping time.
- **Idempotency record**: key, fingerprint of request details, resulting booking, expiry (24 h). It is kept only for successful bookings; a failed attempt leaves no record, so a retry re-evaluates.
- **Booking settings**: per clinic (part of clinic settings) for booking window days, minimum lead time and max active bookings per mobile. Per deployment (service configuration) for rate-limit values, demo mode and retention periods.
- **Audit log entry**: actor (anonymous fingerprint), action, outcome, target, timestamp. No patient data; purged after 90 days in demo mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor on a mid-range phone can go from opening Book Appointment to seeing the confirmation in under 60 seconds (measured in an end-to-end run and a manual timed check); from a doctor's page in under 45 seconds.
- **SC-002**: In 100 repeated concurrency runs of 20 simultaneous bookings for the same slot, every run ends with exactly one booking and 19 "slot taken" responses (0 double-bookings).
- **SC-003**: Repeating a booking request with the same idempotency key (sequentially and concurrently) results in 1 booking in 100% of test runs.
- **SC-004**: For a fixed set of reference cases (breaks, leave, holiday, lead time, existing bookings, day boundary), the slots shown match the expected list in 100% of cases, independent of the visitor's and server's time zone.
- **SC-005**: 0 occurrences of patient name, mobile, email or reason in captured page addresses and server logs across the full end-to-end suite.
- **SC-006**: 100% of abuse-limit tests (IP, mobile, max active bookings, honeypot, lookup) return the documented refusal and create no booking.
- **SC-007**: Each booking step passes automated accessibility checks with 0 serious or critical violations and can be completed with keyboard only.
- **SC-008**: Available times for a chosen doctor appear within 1 second for 95% of requests when the backend is awake; the Book Appointment page keeps a mobile performance score of at least 90.
- **SC-009**: The losing visitor in a slot race can pick an offered alternative slot and finish booking without retyping any details.
- **SC-010**: With the backend unreachable, the site build succeeds and the booking page shows the friendly "call the clinic" message in 100% of test runs.
- **SC-011**: In tests with a fixed clock, 100% of demo bookings whose appointment ended more than 7 days ago are gone after startup or the next booking, and 100% of newer bookings remain.
- **SC-012**: Starting the booking service, or the website server in production, without the shared secret fails 100% of the time with a message naming the setting; the website build still succeeds.
- **SC-013**: A search of the site's published wording finds 0 statements that booking is unavailable or that no personal data is collected, and the privacy page lists what booking collects and how long it is kept.

## Constraints (set by the user and constitution)

- Principle I (Honesty): demo notice on every step; sample labels; seed data only.
- Principle II (Privacy): booking and lookup rate limited; booking audit-logged; no patient data in logs or URLs.
- Principle III (Server is the source of truth): slots and booking rules computed on the server; double-booking prevented by a database constraint; Asia/Karachi everywhere; PKR prices.
- Principle IV (API-first): slot and booking endpoints are the same ones the future staff app and AI agent will use.
- Principle V (Resilience): build and pages survive a down backend.
- Principle VI (Security): same-origin proxy; Origin/CSRF checks on the booking request at the website; shared-secret check plus foreign-origin rejection at the backend; no secrets in the browser.
- Principle VII (Databases): schema changes by reversible migrations; tests never touch production; seed refuses production.

## Assumptions

- **Defaults** (all configurable): booking window 14 days; minimum lead time 2 hours; max 3 upcoming active bookings per mobile; IP limit 10 booking attempts/hour; mobile limit 5 booking attempts/24 hours; lookup limit 20 requests/minute per IP; slot reads under the general limit of 60 requests/minute per IP; idempotency records kept 24 hours; up to 5 alternative slots offered.
- **Time storage**: all instants are stored in UTC and shown in the clinic time zone; weekly sessions and clinic holidays are calendar values interpreted in the clinic time zone (plan decision).
- **Status**: with no staff dashboard yet, online bookings are "confirmed" immediately. Cancel/complete statuses are reserved for later features.
- **Breaks**: modelled as gaps between a day's schedule sessions (the existing Feature 003 structure already allows several sessions per day); no separate break entity is needed.
- **Slot length**: per session, from the existing schedule (seed default 15 minutes).
- **Doctor leave and clinic holidays** are managed by seed data and direct database updates for now; staff screens to edit them come with the staff dashboards (out of scope).
- **Booking reference format**: 10 unambiguous letters and digits shown as two groups, e.g. `K7P4Q-9TXM2` (no clinic prefix, since the product is white-label).
- **Confirmation view** is masked everywhere (FR-051) because there is no login yet.
- **Client IP** is taken from the trusted proxy chain (website proxy → backend), not from arbitrary client headers.
- **Fee** shown and stored is the doctor's consultation fee in PKR at booking time.

## Dependencies

- Feature 003 catalog service (doctors, departments, weekly schedules with slot length, clinic settings with time zone, clinic rules) and its committed contract.
- Feature 004 website data layer, same-origin access pattern, resilience behaviour and "Before your visit" list.
- Existing Book Appointment route and doctor pages (which already link to it).

## Out of Scope

- OTP login and patient accounts (Feature 007).
- My Appointments, cancel or reschedule by the patient.
- SMS, email or WhatsApp confirmations and reminders.
- Lab test and health package booking.
- Staff/receptionist/doctor dashboards, and staff screens for schedules, leave and holidays.
- Payments or deposits.
- Waiting lists and walk-in queue management.
