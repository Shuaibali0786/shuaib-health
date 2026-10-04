# Feature Specification: Connect the Public Website to the Catalog API

**Feature Branch**: `004-catalog-api-integration`
**Created**: 2026-10-03
**Status**: Draft
**Input**: User description: "Feature 004: Connect the public website to the catalog API (Feature 003). Doctors, departments, lab tests, test categories, health packages, clinic settings (name, phone, address, hours, logo) and clinic rules on the public site must come from the backend API instead of hard-coded frontend data, so a clinic can change its data without touching code (white-label)."

## Overview

Features 001–002 built the public website with clearly labelled sample data stored in the frontend code. Feature 003 built a read-only catalog service that holds the same data. This feature makes the website read its catalog and clinic identity from that service, so that a different clinic can be served by changing data only — with no code change and no rebuild — while the website stays fast and never breaks when the service is slow, asleep, or down.

## Clarifications

### Session 2026-10-03

- Q: Where should the clinic rules appear on the public site? → A: As a "Before your visit" list on the Contact and Book Appointment pages, built only from existing components and styles.
- Q: When the site has never received clinic settings and the service is down, what should the site show for the clinic? → A: One fallback copy of the clinic settings, supplied through deployment configuration (never in code), used only in that case so the emergency number is always visible.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitors see the clinic's live catalog (Priority: P1)

A patient opens the home page, the doctors list, a doctor's profile, the departments pages, the lab tests list and detail pages, and the health packages page. Everything they see about doctors, departments, schedules, tests, categories, prices and packages is the clinic's current data from the catalog service, looking exactly as it does today.

**Why this priority**: This is the core purpose of the feature — without it the site is still a hard-coded demo and cannot be white-labelled.

**Independent Test**: With the service running and seeded, change one doctor's name and one lab test price in the service's data, wait for the refresh period, reload the pages, and see the new values with no code change, no rebuild and no redeploy.

**Acceptance Scenarios**:

1. **Given** the service holds the seeded sample catalog, **When** a visitor opens any catalog page, **Then** the page shows the same content, order and layout as before this feature (pixel-identical apart from data that legitimately differs, e.g. internal IDs never shown).
2. **Given** a staff member changed a doctor's name in the service, **When** a visitor loads that doctor's page after the refresh period (about 5 minutes), **Then** the new name is shown everywhere that doctor appears (home, list, profile, department page).
3. **Given** a record was made inactive in the service, **When** the refresh period passes, **Then** it disappears from lists and its detail page shows the normal "not found" page.
4. **Given** a new doctor, department, lab test or package was added in the service, **When** the refresh period passes, **Then** it appears in lists and its detail page opens, even though it did not exist when the site was built.
5. **Given** the doctor list and lab test filters (department, weekday, name search, category, text search), **When** a visitor uses them, **Then** they behave exactly as today.

---

### User Story 2 - The site never breaks when the service is slow, asleep or down (Priority: P1)

The catalog service runs on a host that sleeps when idle and can take about 50 seconds to wake up, and it may be down. A visitor who arrives at such a moment still gets a fast, working page: either the last good data the site already had, or a friendly message — never a crash, error trace, endless spinner or blank page.

**Why this priority**: A broken or hanging medical clinic website is worse than a slightly stale one; this is a constitution requirement (Principle V) and a precondition for shipping Story 1.

**Independent Test**: Build the site with the service unreachable (build succeeds). Then run the site with the service (a) down, (b) answering only after 60 seconds, (c) returning server errors, and open every public page; each returns a usable page within the time budget.

**Acceptance Scenarios**:

1. **Given** the service address is unset or points to a dead host, **When** the production build runs, **Then** the build succeeds.
2. **Given** the site has previously shown good data and the service then goes down, **When** a visitor opens a catalog page, **Then** the last good data is shown, with no error visible to the visitor.
3. **Given** the site has never received good data (fresh start) and the service is down, **When** a visitor opens a catalog page, **Then** a friendly message explains the information is temporarily unavailable and offers a way to try again and to reach the clinic, and the rest of the page (header, footer, navigation, editorial content) still works.
4. **Given** the service is asleep and takes about 50 seconds to answer, **When** a visitor opens a page, **Then** the page is delivered within the time budget (see SC-004) using last good data or the friendly message; the visitor is never made to wait for the service to wake up.
5. **Given** the service is down, **When** a visitor opens a detail page for a slug, **Then** they see last good data or the friendly message — never a false "not found" page.
6. **Given** the service returns malformed or unexpected data, **When** a page is built from it, **Then** the bad data is rejected and treated like an outage (last good data or friendly message), never shown half-rendered.

---

### User Story 3 - The clinic's identity and rules come from data (Priority: P2)

The clinic name, tagline, logo, phone numbers (general and emergency), address, opening hours, lab hours and map area shown in the header, footer, contact page, home page, page titles, share images and search metadata come from the service's clinic settings. The demo notice and credit line are fixed by the project constitution, so they stay exactly as today whatever the service holds (FR-060). The clinic's active rules, in their configured order, are shown to visitors from the service.

**Why this priority**: This is what makes the site white-label; it depends on the same data layer as Story 1 and is lower risk.

**Independent Test**: Change the clinic name, the emergency number and one rule in the service; after the refresh period, every place that shows them updates with no code change.

**Acceptance Scenarios**:

1. **Given** the seeded clinic settings, **When** a visitor opens any page, **Then** the header, footer, contact details, hours and demo notice look exactly as today.
2. **Given** the clinic name was changed in the service, **When** the refresh period passes, **Then** the new name appears in the header, footer, page titles, share previews and search metadata.
3. **Given** the clinic's active rules, **When** a visitor views them, **Then** they appear in the configured order in a "Before your visit" list on the Contact and Book Appointment pages, and inactive rules are never shown.
5. **Given** the service has zero active rules, **When** a visitor opens those pages, **Then** the "Before your visit" list is omitted entirely (no empty heading).
6. **Given** a fresh start (no good clinic settings ever received) and the service is down, **When** a visitor opens any page, **Then** the header, footer and emergency details show the fallback clinic settings from deployment configuration, so the emergency number is always visible.
4. **Given** the seeded settings reference the clinic logo file, **When** any client loads that logo address, **Then** a valid, original logo mark image is returned (it is currently missing).

---

### User Story 4 - Developers can trust the connection (Priority: P2)

A developer working on either side can see immediately when the website and the service stop agreeing on the shape of the data, can point the website at a local, preview or production service through configuration only, and can run all existing website tests without a running service.

**Why this priority**: Protects Stories 1–3 from silent breakage over time; enables safe future features (booking, admin).

**Independent Test**: Rename one field in the published service description; the website's contract check fails with a message naming the field. Run the whole website test suite with no service running; it passes.

**Acceptance Scenarios**:

1. **Given** the website's expected data shapes and the service's published description, **When** they differ (field added as required, removed, renamed or type changed), **Then** an automated check fails and names the difference.
2. **Given** no service is running, **When** the website's unit and end-to-end tests run, **Then** they all pass using recorded sample responses.
3. **Given** different service addresses for local, preview and production, **When** each environment is configured, **Then** the site uses its own address and the address never appears in code shipped to visitors' browsers.

---

### Edge Cases

- **Service slow but eventually answers** (beyond the time budget): visitor gets last good data or friendly message now; the next visitor after the service answers gets fresh data.
- **Service recovers after an outage**: fresh data appears within one refresh period, with no restart or redeploy of the website.
- **Partial outage**: one data request fails while others succeed (e.g. doctors load, departments fail) — sections with good data render; only the failing section shows the friendly message (or last good data); the page as a whole still renders.
- **Rate limited by the service (too many requests)**: treated like a temporary outage; the website's own request volume stays far below the service's per-client limit thanks to caching.
- **Empty lists** (e.g. a clinic with zero packages): the existing empty states are shown, not the outage message.
- **Lists longer than one page** of service results: all records are shown, in the service's order, as today.
- **Cross-references to missing records** (a doctor whose department is inactive, a package listing a test slug that no longer exists): the dangling reference is skipped silently, as the site does today with unknown slugs.
- **Images**: photos and the logo keep working; a missing image shows the existing image fallback.
- **Unknown slug while service is healthy**: normal "not found" page with correct not-found status.
- **Clinic settings unavailable on a fresh start**: the fallback clinic settings from deployment configuration are shown (FR-022); if that fallback is also missing or invalid, the site still renders with a neutral identity, the phones hidden, and the friendly message, and a server-side warning is logged.
- **Clinic rules unavailable** (fresh start, service down): the "Before your visit" list is omitted; the rest of the Contact / Book Appointment page renders normally.
- **Sample / portfolio-demo labels**: always shown exactly as today, whether data is live, cached or unavailable.

## Requirements *(mandatory)*

### Functional Requirements

**Data source**

- **FR-001**: Every public page and shared element that shows doctors, doctor schedules, departments, lab tests, lab test categories, health packages, clinic settings or clinic rules MUST obtain that data from the catalog service, including page titles, search metadata, share images, the sitemap and structured data.
- **FR-002**: The hard-coded catalog and clinic-settings data MUST be removed from the website's runtime code. Copies MAY remain only as test fixtures, which MUST NOT be reachable from production pages. A search of production code for a sample doctor's name or the sample clinic phone number MUST find nothing outside test fixtures.
- **FR-003**: Editorial content that the service does not provide (health tips, FAQ, about page copy, legal pages, home page marketing copy, navigation) MUST remain in the website unchanged.
- **FR-004**: Records added in the service after the site was built MUST be viewable (lists and detail pages) without a rebuild or redeploy.
- **FR-005**: All records MUST be shown; if the service splits a list across pages, the website MUST gather every page in the service's order.
- **FR-006**: Only active records returned by the service are shown; the website MUST NOT add, hide or reorder records beyond what it does today (e.g. featured doctors limit, display-order sorting).

**Resilience**

- **FR-010**: The production build MUST succeed when the service is unreachable, unset, slow or returning errors.
- **FR-011**: A page MUST NOT wait for the service longer than a fixed time budget (default 3 seconds per page render). The budget applies to each piece of data as a whole: when a list spans several service pages, all of them share the same 3 seconds, and different pieces of data are requested in parallel (FR-021). After the budget, the page MUST use the last good data, or the friendly unavailable message if none exists.
- **FR-012**: When fresh data cannot be obtained, the site MUST continue serving the last good data it received, for as long as the outage lasts.
- **FR-013**: When no good data has ever been received, the affected section MUST show a friendly, plain-language "temporarily unavailable" message with a retry option and a way to reach the clinic; the page MUST still render header, footer, navigation and unaffected sections with a successful (non-error) page status.
- **FR-014**: A detail page MUST show "not found" only when the service confirms the record does not exist; outages and timeouts MUST NOT produce a "not found" page.
- **FR-015**: Responses that do not match the expected data shape MUST be rejected and handled as an outage.
- **FR-016**: Failures MUST be logged on the server side with the service's request ID where available, without personal data; visitors MUST never see technical details (stack traces, addresses, status codes).

**Speed**

- **FR-020**: Service responses MUST be cached by the website and refreshed about every 5 minutes, consistent with the service's own caching rules; refreshing MUST happen without making a visitor wait. **Exception**: the first visitor ever to open a page that has never been generated (for example, a record added after the build) may wait for the service, capped by the FR-011 budget.
- **FR-021**: Independent data needed for one page MUST be requested in parallel, not one after another.
- **FR-022**: When no good clinic settings have ever been received and the service is unavailable, the site MUST use one fallback copy of the clinic settings supplied through deployment configuration (server-side only, not in code). It MUST be validated like service data, MUST be used only in this case (never in preference to live or last good data), and MUST NOT contain catalog records. If it is missing or invalid, the site renders a neutral identity with phones hidden plus the friendly message, and logs a server-side warning; the build MUST still succeed.
- **FR-023**: Home and listing pages MUST load at least as fast as before this feature (see SC-003).

**Configuration and security**

- **FR-030**: The service address MUST come from one environment setting, with separate values for local, preview and production; it MUST be used on the server side only and MUST NOT appear in code or data sent to the browser.
- **FR-031**: No secrets or tokens are introduced; the example environment file MUST document the new settings (service address and fallback clinic settings) with placeholder values.
- **FR-032**: The website MUST NOT need any change to the service's cross-origin allowlist, because browsers never call the service directly.

**Contract**

- **FR-040**: The website MUST have one typed data-access layer for the service whose shapes match the service's published description (the committed OpenAPI contract of Feature 003).
- **FR-041**: An automated contract check MUST fail when the website's expected shapes and the published contract drift apart (field removed, renamed, type changed, or newly required).
- **FR-042**: The website's existing content types (`SiteConfig`, `Department`, `Doctor`, `ScheduleSession`, `LabTestCategory`, `LabTest`, `HealthPackage`, `ImageAsset`) MUST continue to be what components receive, so components do not change.

**Brand asset**

- **FR-050**: The website MUST serve the logo mark at the path referenced by the seeded clinic settings (`brand/logo-mark.svg` under the site's images). It MUST be an original, simple, premium mark consistent with the existing in-site logo, contain no other brand's logo or trademark, render crisply at 32–512 px, and include an accessible title.

**Honesty and design**

- **FR-060**: All "Sample" badges, portfolio-demo notices and illustrative-data notes MUST remain exactly as they are today (same text, same places). The demo notice ("Portfolio demo — not a real clinic, not medical advice.") and the credit ("Designed & built by Shuaib Ali", linking to https://github.com/Shuaibali0786) are required by the constitution. They MUST always be shown with exactly that text, even if the service's clinic settings hold different values or are unavailable.
- **FR-061**: There MUST be no visual design changes: layout, typography, colours, spacing, motion and component appearance stay the same. The only additions are the friendly unavailable message and the "Before your visit" rules list (FR-062), and both MUST reuse existing components and styles (e.g. the existing empty-state, section heading and list patterns).
- **FR-062**: The Contact and Book Appointment pages MUST show the clinic's active rules, in configured order, as a "Before your visit" list; the list is omitted when there are no rules or the rules are unavailable.

**Testing**

- **FR-070**: All existing website unit and end-to-end tests MUST keep passing, updated to use the data-access layer with recorded or mocked responses rather than the removed hard-coded data.
- **FR-071**: New automated tests MUST cover: service down (fresh start and with last good data), service slow beyond the time budget, server error responses, malformed responses, partial outage on one page, unknown slug vs outage, build with service unreachable, and the contract drift check.
- **FR-072**: Type checks, lint and the production build MUST pass.

### Key Entities

- **Clinic settings**: the single clinic identity record — name, tagline, full title, logo, brand colours, phones, emergency number, address, timezone, opening hours, lab hours, map area, demo notice, credit line, indexable flag.
- **Clinic rule**: an ordered, active text rule shown to visitors.
- **Department, Doctor (with weekly schedule), Lab test category, Lab test, Health package**: the catalog records as defined in Feature 003, shown by the website unchanged in meaning.
- **Last good data**: the most recent valid copy of each piece of service data the website holds, used during outages and slow periods.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Changing the clinic name, one doctor, one lab test price and one rule in the service updates 100% of the places they appear on the public site within 6 minutes, with zero code changes, rebuilds or redeploys.
- **SC-002**: With the service unreachable, the production build succeeds 100% of the time, and every public page returns a usable page (no crash, no blank page, no error trace) in end-to-end tests.
- **SC-003**: Home and listing pages score at least as well as before this feature on the same lab performance audit (performance score not lower than the pre-feature baseline, and at least 90 on mobile), with no increase in largest-contentful-paint beyond 10%.
- **SC-004**: No page takes longer than 4 seconds to deliver because of the service, including when the service needs about 50 seconds to wake up.
- **SC-005**: After an outage ends, fresh data is shown within one refresh period (about 5 minutes) without restarting the website.
- **SC-006**: 0 occurrences of the service address in any file delivered to browsers, and 0 hard-coded catalog/clinic records in production website code (outside test fixtures).
- **SC-007**: The contract check detects 100% of injected drifts in the test set (removed field, renamed field, changed type, newly required field).
- **SC-008**: 100% of pre-existing website tests pass, plus the new resilience tests, with no service running.
- **SC-009**: Visual comparison of every public page against the pre-feature version, using the seeded data, shows no design differences other than the added "Before your visit" list on the Contact and Book Appointment pages.
- **SC-010**: On a fresh start with the service down and the fallback configured, the emergency number is visible on 100% of public pages.

## Constraints (set by the user and constitution)

- Constitution Principle V (Resilience): build must not depend on the service; runtime pages show friendly fallbacks; tested by building against a dead service and by an end-to-end test with the service blocked.
- No visual design changes (only additions: the friendly unavailable message and the "Before your visit" rules list, both from existing components); "Sample" / portfolio-demo labels unchanged.
- Service address from environment configuration only; nothing secret in the browser.
- Smallest viable change: components keep receiving today's content types; the existing content-access module remains the single place components read content from.

## Assumptions

- **Contract location**: the service's published description lives at `specs/003-catalog-api/contracts/openapi.yaml` (the user referred to `backend/openapi.yaml`; no such file exists). The service also publishes it live at `/openapi.json`; the committed file is already checked against the service by Feature 003 tests, so the website checks against the committed file.
- **Last good data** is held by the website's own cache; it survives between requests on a running instance but is not guaranteed to survive a redeploy. A fresh deployment with the service down therefore falls under the "never received good data" case (catalog sections show the friendly message; clinic identity uses the configured fallback).
- **Fallback clinic settings** are per-clinic deployment configuration, kept in sync by whoever deploys the clinic; for the sample clinic the example environment file carries the seeded sample values, marked as sample. This is clinic configuration, not hard-coded data, so it satisfies FR-002.
- **Time budget** of 3 seconds per page render for service calls (shared by all pages of one list; separate data requested in parallel) is a reasonable default for a clinic website (SC-004 allows 4 seconds end to end).
- **Refresh period** of about 5 minutes matches the service's default cache lifetime (Feature 003 FR-070).
- **IDs**: the service returns random IDs; the website only compares IDs for equality and looks pages up by slug, so no URL changes.
- **Images**: image addresses returned by the service point to the website's existing `/images/...` files; no new image hosting.
- **Logo**: the new logo mark file is derived from the existing in-site logo mark so the site's appearance does not change; the header keeps its current logo rendering.
- **Rate limit**: thanks to caching, the website makes at most a few dozen service requests per refresh period, well below the service's default limit of 60 per minute per client.

## Dependencies

- Feature 003 catalog service and its committed OpenAPI contract, running locally (and later in preview/production) with seeded sample data.
- Existing website content types and content-access module from Features 001–002.

## Out of Scope

- Booking, appointments, availability and slot calculation.
- Login, OTP, accounts.
- Admin or staff screens for editing data.
- Deployment and hosting configuration (environment values for preview/production are documented, not provisioned).
- Moving health tips, FAQ, about, legal or home marketing copy into the service.
- Any change to the service itself, except where the contract check reveals a genuine defect (to be raised, not silently fixed).
