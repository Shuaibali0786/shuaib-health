# Feature Specification: Command Centre Completion

**Feature Branch**: `008-command-centre-completion`
**Created**: 2026-11-07
**Status**: Draft (built in the unattended overnight run of 6–7 Nov 2026; owner review pending)
**Input**: User description: "Command Centre completion: overview stats, bookings list with filters and search, status change, doctors today, insights chart, activity/audit log, staff roles, fully mobile."

## Context and gap analysis

Feature 006 already ships almost everything in the request (156 of 157 tasks ticked in `specs/006-clinic-command-centre/tasks.md`):

| Requested | Already in 006 | Gap found |
|---|---|---|
| Overview stats | KPI cards with trend vs last week, agenda, next up, status mix | none |
| Bookings list, filters, search | search (reference/name), single-day date, doctor, department, status chips, pagination, drawer | **only one day can be picked in the UI** although the API and address accept a range (`from`/`to`); no quick "Today / Tomorrow / Next 7 days / Last 7 days" |
| Status change | Confirmed → Arrived → Completed / No-show / Cancelled, confirm + undo, server rules | none |
| Doctors today | booked vs free slots, utilisation | none |
| Insights chart | 7/30/90-day charts, departments, status, busy hours | none |
| Activity / audit log | admin-only feed with event and staff filters, pagination | none |
| Staff roles | Admin and Receptionist; admin-only staff screen | **nobody can see what each role may do**; a clinic owner choosing a role has to guess |
| Fully mobile | bottom nav, cards, sticky filters, tested at 360–1440 px | **no printable day list** (front desks print the day's list as a paper fallback) |

This feature fills those three gaps only. It does not rebuild what works.

## Assumptions (decided by the agent; owner unavailable overnight, also in `specs/QUESTIONS-FOR-SHUAIB.md`)

- A-1: "Staff roles" means making the existing two roles understandable (a permissions table), **not** adding new roles. Doctor and Lab staff roles need a database migration, new server policies and auth-matrix tests; that is a separate feature and a question for Shuaib.
- A-2: The printable day list keeps phone numbers **masked** (exactly as on screen). A print with full phone numbers would need its own audit event and is out of scope.
- A-3: No CSV/Excel export: it would move patient names out of the audited system. Question for Shuaib.
- A-4: Quick ranges are computed from the clinic's "today" (Asia/Karachi) that the page already receives from the server, never from the device clock.
- A-5: No backend, API contract or database change. Frontend only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick date ranges on Bookings (Priority: P1)

A receptionist wants tomorrow's list to call patients, or the owner wants the last 7 days. Under the filters, a row of chips offers **Today**, **Tomorrow**, **Next 7 days** and **Last 7 days**. One tap filters the list; the chip shows as selected; the address keeps the range so the view can be shared or reloaded.

**Why this priority**: Most-used daily action; today it needs the date picker twice or a hand-edited address.

**Independent Test**: Open Bookings, tap "Next 7 days": the address gains `from=<today>&to=<today+6>`, the date field label shows the range, the list reloads, the chip is pressed.

**Acceptance Scenarios**:
1. **Given** Bookings is open, **When** "Tomorrow" is tapped, **Then** `from` and `to` both equal clinic today + 1 day and page resets to 1.
2. **Given** a range equal to one chip's range, **When** the page loads, **Then** that chip shows `aria-pressed="true"` and the others `false`.
3. **Given** a range set from the date picker that matches no chip, **Then** no chip is pressed.
4. **Given** the demo viewer, **When** a chip is used, **Then** it works the same on the synthetic data.

### User Story 2 - Roles and permissions explained (Priority: P2)

On the Staff screen, a card "What each role can do" lists the actions (view bookings, change status, reveal phone, view insights, view activity log, manage staff) with a tick or a dash for Admin and Receptionist, plus a note that the server enforces it.

**Why this priority**: Sales and trust: a clinic owner sees the access model at a glance; it also prevents wrong role choices.

**Independent Test**: Open Staff (admin or demo): the table is present, has a caption, and its Activity/Staff rows match the navigation rule used by the app.

**Acceptance Scenarios**:
1. **Given** the Staff screen, **Then** a table with caption "What each role can do" shows one row per capability and one column per role.
2. **Given** the permission list, **Then** "View activity log" and "Manage staff" are Admin-only, consistent with `visibleNavItems` (unit-tested).
3. **Given** a screen reader, **Then** ticks and dashes are announced as "Allowed" / "Not allowed".

### User Story 3 - Print the day list (Priority: P3)

On Bookings, a "Print list" button opens the browser print dialog. The printout shows the clinic name, the range, the time of printing, and the visible bookings (time, reference, patient name, doctor, status, masked phone), without navigation, buttons or the mobile bar. The "Portfolio demo" disclaimer stays on the page.

**Why this priority**: Useful paper fallback during outages; lower frequency.

**Independent Test**: Click "Print list" with `window.print` stubbed: it is called once; in print media emulation the side nav, bottom nav and filters are hidden and the list is visible.

**Acceptance Scenarios**:
1. **Given** Bookings, **When** "Print list" is pressed, **Then** `window.print()` runs.
2. **Given** print media, **Then** navigation, filter controls and action buttons are hidden; booking rows and the disclaimer remain.
3. **Given** print, **Then** phone numbers appear masked exactly as on screen.

### Edge Cases

- Ranges crossing a month or year end (e.g. 29 Dec + 6 days) must produce correct ISO dates (pure date arithmetic on `YYYY-MM-DD`, no time zone).
- Last 7 days = today − 6 … today (7 days inclusive); Next 7 days = today … today + 6.
- An empty list prints with the normal empty-state text, not a blank page.
- Printing does not reveal phones or write audit events.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Bookings MUST offer four quick-range chips: Today, Tomorrow, Next 7 days, Last 7 days, computed from the server-supplied clinic date.
- **FR-002**: Choosing a chip MUST set `from`/`to`, reset page to 1, and keep the other filters.
- **FR-003**: A chip MUST be marked pressed only when the current `from`/`to` exactly equal its range.
- **FR-004**: The Staff screen MUST show a role-permission table derived from one shared definition, which the navigation rule also matches (tested).
- **FR-005**: Bookings MUST offer a "Print list" button that calls the browser print; print styles MUST hide navigation, filters and buttons and keep the disclaimer.
- **FR-006**: No API, database or server-policy change; server authorisation stays the only enforcement.
- **FR-007**: All new controls MUST be keyboard operable, ≥ 44 px targets on mobile, readable in light and dark themes, and pass axe.

### Key Entities

- **Quick range**: id, label, `from`, `to` (derived, not stored).
- **Capability**: id, label, allowed roles (static, shipped with the app).

## Success Criteria *(mandatory)*

- **SC-001**: Any of the four common ranges is reachable in 1 tap (was 2 date-picker uses or unavailable).
- **SC-002**: All existing frontend unit and e2e tests stay green; new unit tests cover range maths (month/year edges), chip pressed state, permission table and print button.
- **SC-003**: axe reports no new violations on Bookings and Staff (desktop and mobile).
- **SC-004**: Public pages unaffected (admin code stays isolated; `check-admin-isolation` passes).

## Out of scope

New roles (Doctor, Lab staff), CSV export, printing unmasked phones, custom date-range picker with two calendars, backend changes.
