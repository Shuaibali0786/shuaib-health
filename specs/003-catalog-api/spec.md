# Feature Specification: Backend Foundation + Read-Only Clinic Catalog API

**Feature Branch**: `003-catalog-api`
**Created**: 2026-10-03
**Status**: Draft
**Phase**: 2 (Backend) — first backend piece (Constitution X)
**Input**: User description: "Feature 003: Backend foundation + read-only clinic catalog API for Shuaib Health (Phase 2, first backend piece). Follow the constitution (API-first, server is source of truth, security, privacy, honesty, Asia/Karachi, PKR). Goal: a real, secure backend that serves the clinic's public catalog from the database, so the website (Feature 004) and later the booking flow, staff app and AI agent all read the SAME data through the SAME API. No writes, no login, no booking in this feature." (full text recorded in `history/prompts/003-catalog-api/`)

## Overview

Today the website reads its clinic details, departments, doctors, lab tests and health packages from static mock files bundled into the frontend. This feature creates the backend that becomes the single source of truth for that catalog. Every future client (website, booking flow, staff app, AI agent) reads the same records through the same public read-only endpoints. Nothing about the clinic is written into backend code: a different clinic is a different database with different rows, with no code change (white-label, single-tenant).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse doctors and departments through the API (Priority: P1)

A client (the website in Feature 004, later the staff app or AI agent) asks the backend for the list of departments and doctors, filters doctors by department, by name, or by the weekday they consult on, and opens one doctor's profile including their weekly schedule.

**Why this priority**: Doctors and departments are the core of a clinic catalog and the input to the booking flow that follows. Without them no later Phase 2 feature can start.

**Independent Test**: Load the sample data into a fresh database, call the department and doctor endpoints, and compare every record field by field with the frontend mock files.

**Acceptance Scenarios**:

1. **Given** the sample data is loaded, **When** a client requests the department list, **Then** it receives all 7 sample departments in their configured sort order, each with the same fields and values the frontend `Department` type and mock file use.
2. **Given** the sample data is loaded, **When** a client requests doctors filtered by the Cardiology department, **Then** only active Cardiology doctors are returned.
3. **Given** the sample data is loaded, **When** a client searches doctors for "hassan" (any letter case), **Then** "Dr. Hassan Mirza" is returned and doctors whose names do not contain the text are not.
4. **Given** the sample data is loaded, **When** a client filters doctors by weekday "fri", **Then** only doctors with at least one Friday session are returned.
5. **Given** the sample data is loaded, **When** a client requests `dr-hassan-mirza`, **Then** the profile includes qualifications, languages, experience, fee in PKR, photo, sample flag, and the weekly schedule (weekday, start, end, slot length) in Asia/Karachi time.
6. **Given** a doctor is marked inactive, **When** a client lists doctors or requests that doctor by slug, **Then** the doctor does not appear in the list and the slug returns "not found".
7. **Given** any slug that does not exist, **When** a client requests it, **Then** the response is "not found" in the standard error format.

---

### User Story 2 - Browse lab tests and health packages through the API (Priority: P1)

A client lists lab tests, searches them by name or "also known as" names, filters them by category, opens one test, lists health packages and opens one package with its included tests.

**Why this priority**: The lab catalog is the second half of the clinic's public offering and is browsed as often as doctors; it carries prices that only the server may decide (Constitution III).

**Independent Test**: With the sample data loaded, call the lab-test, lab-test-category and health-package endpoints and compare with the frontend mock files.

**Acceptance Scenarios**:

1. **Given** the sample data is loaded, **When** a client lists lab tests with no filter, **Then** it receives all 26 sample tests across pages, each with price in whole PKR, sample type, report time, preparation, home-collection flag, also-known-as names and sample flag.
2. **Given** the sample data is loaded, **When** a client searches "HbA1c" or an also-known-as name of a test, **Then** that test is returned.
3. **Given** the sample data is loaded, **When** a client filters by category "thyroid", **Then** only tests in the Thyroid category are returned.
4. **Given** the sample data is loaded, **When** a client requests a health package by slug, **Then** it receives the package with its included tests (by slug, in the configured order), package price in PKR, preparation and home-collection flag.
5. **Given** the sample data is loaded, **When** a client lists lab test categories, **Then** it receives the 9 categories in the configured order.

---

### User Story 3 - Read white-label clinic settings and rules (Priority: P2)

A client asks the backend for the clinic's identity and rules: name, tagline, logo, brand colours, address, phone numbers, emergency number, timezone, opening hours, lab hours, demo notice, credit line, and the ordered list of active clinic rules.

**Why this priority**: White-labelling is a day-one requirement, and the demo notice and emergency number must come from one trusted place. It ranks below the catalog because the frontend already has these values and they change rarely.

**Independent Test**: Change the clinic name and one rule directly in the database, call the endpoints, and see the new values with no code change or restart.

**Acceptance Scenarios**:

1. **Given** the sample data is loaded, **When** a client requests the clinic settings, **Then** it receives the same values as the frontend `siteConfig` mock, plus logo and brand colours, including the demo notice "Portfolio demo — not a real clinic, not medical advice."
2. **Given** the clinic rules exist, **When** a client requests them, **Then** only active rules are returned, in their configured order.
3. **Given** an operator changes the clinic name in the database, **When** a client requests the clinic settings (after the cache period), **Then** the new name is returned without any code change.

---

### User Story 4 - Load sample data safely and repeatedly (Priority: P2)

A developer runs one seed command to load the sample catalog into an empty or existing database. Running it again leaves exactly one copy of every record.

**Why this priority**: Every developer, every test run and every later feature needs the same known data.

**Independent Test**: Run the seed command three times on a fresh database; record counts and contents are identical after each run and match the frontend mock files.

**Acceptance Scenarios**:

1. **Given** an empty migrated database, **When** the seed command runs, **Then** it loads exactly the records in the frontend mock files (1 clinic settings record, 7 departments, 9 doctors with their schedules, 9 lab test categories, 26 lab tests, 5 health packages) plus the sample clinic rules, all marked as sample.
2. **Given** a seeded database, **When** the seed command runs again, **Then** no duplicate is created and changed sample values are restored to the mock values.
3. **Given** the seed command is pointed at a database flagged as production, **When** it runs, **Then** it refuses and makes no change.

---

### User Story 5 - Operate the backend safely (Priority: P2)

An operator or monitoring tool checks whether the backend is alive and whether it can reach its database. Every request is traceable by a request ID, abusive callers are throttled, and nothing private leaks in responses or logs.

**Why this priority**: The security and privacy baseline set here is reused by every later feature (auth, booking, staff app), so it must be correct from the start.

**Independent Test**: Call the liveness and readiness checks with the database up and down; exceed the rate limit; send a request from a non-allowed origin; inspect logs and error responses.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** the liveness check is called, **Then** it returns healthy without touching the database.
2. **Given** the database is unreachable, **When** the readiness check is called, **Then** it reports not ready (503) with no connection details in the body.
3. **Given** one client IP exceeds the per-IP limit, **When** it sends another request, **Then** it receives 429 with a `Retry-After` value.
4. **Given** a request from an origin not on the allowlist, **When** it reaches the backend, **Then** no cross-origin permission headers are returned.
5. **Given** any request, **When** the response is sent, **Then** it carries a request ID (the caller's valid ID is reused, otherwise a new one is generated), and the same ID appears in the log line for that request.
6. **Given** an unexpected server error, **When** the client receives the response, **Then** it is a generic 500 in the standard error format with the request ID and no stack trace, SQL, or internal detail.

---

### Edge Cases

- **Unknown slug** on any detail endpoint → 404 in the standard error format.
- **Invalid query values** (page 0, negative page, page size above the maximum, search text longer than the limit, unknown weekday, malformed slug) → 422 in the standard error format naming the bad parameter, never a 500.
- **Unknown department or category slug used as a filter** → empty list (200), not an error.
- **Page past the end** → empty item list with correct totals.
- **Search text with special characters** (`%`, `_`, quotes, SQL keywords) → treated as literal text; no error, no injection.
- **Inactive records** (doctor, department, test, package, rule) → hidden from all public lists and detail endpoints.
- **A package that includes an inactive test** → the inactive test is omitted from the package's included tests; the package price is unchanged (server-decided).
- **Doctor with no schedule rows** → returned with an empty schedule, not an error.
- **Clinic settings missing** (unseeded database) → clinic endpoint returns 503 "not configured" in the standard format; readiness reports not ready.
- **Conditional request with a matching ETag** → 304 with no body.
- **Database slow or down mid-request** → standard 503 error, no connection string or SQL in the response or logs.
- **Request ID header that is too long or contains unsafe characters** → ignored and replaced with a generated ID.

## Requirements *(mandatory)*

### Functional Requirements

**White-label and single source of truth**

- **FR-001**: The system MUST NOT contain clinic-specific values (name, logo, colours, address, phones, emergency number, timezone, hours, demo notice, credit line, rules) in application code; they MUST come only from stored data. A repository search for the sample clinic name in backend source (excluding the seed data file and tests) MUST find nothing.
- **FR-002**: The system MUST serve one clinic per deployment (single-tenant: one database per clinic).
- **FR-003**: All prices MUST be stored and returned as whole PKR integers; the API MUST NOT compute or accept prices from clients.
- **FR-004**: All schedule times MUST be interpreted in the clinic's timezone (Asia/Karachi for the sample clinic); stored timestamps MUST carry a timezone.
- **FR-005**: Internal record IDs MUST be non-guessable random identifiers; public detail endpoints MUST be addressed by slug.

**Public read-only catalog endpoints (versioned under `/api/v1`)**

- **FR-010**: The system MUST provide clinic settings (`GET /clinic`) and the ordered list of active clinic rules (`GET /clinic/rules`).
- **FR-011**: The system MUST provide departments: list (`GET /departments`) and detail by slug (`GET /departments/{slug}`).
- **FR-012**: The system MUST provide doctors: list (`GET /doctors`) with optional filters for department slug, name search, and weekday; and detail by slug (`GET /doctors/{slug}`) including the weekly schedule.
- **FR-013**: The system MUST provide lab tests: list (`GET /lab-tests`) with optional text search (name and also-known-as, case-insensitive) and category filter; and detail by slug (`GET /lab-tests/{slug}`).
- **FR-014**: The system MUST provide lab test categories (`GET /lab-test-categories`) because the frontend's `LabTest.categoryId` and category filter depend on them.
- **FR-015**: The system MUST provide health packages: list (`GET /health-packages`) and detail by slug (`GET /health-packages/{slug}`) with included tests.
- **FR-016**: Each item in a response MUST use the same field names, value types and meaning as the frontend types in `frontend/src/types/content.ts` (`SiteConfig`, `Department`, `Doctor`, `ScheduleSession`, `LabTestCategory`, `LabTest`, `HealthPackage`, `ImageAsset`). Fields this feature adds (clinic logo and colours, rules, `slotMinutes` on schedule sessions) MUST be additive only. Field-by-field contract tests MUST compare seeded API output with the mock files.
- **FR-017**: Cross-references (`departmentId`, `categoryId`, `relatedDepartmentIds`) MUST hold the referenced record's API `id`; slug references (`relatedTestSlugs`, `testSlugs`) MUST hold slugs, as in the frontend types.
- **FR-018**: List endpoints MUST be paginated with a page number and page size (default 20, maximum 100) and MUST return the items plus total count, page and page size. Ordering MUST be stable (configured sort order, then name).
- **FR-019**: Public endpoints MUST return only active records.
- **FR-020**: The system MUST NOT expose any write endpoint (create, update, delete) in this feature; non-GET methods on catalog paths MUST return 405.
- **FR-021**: The system MUST publish a machine-readable API description (OpenAPI) for every endpoint, its parameters, response shapes and error responses.

**Errors**

- **FR-030**: Every error response MUST use one consistent JSON format containing a stable machine-readable code, a human-readable message, and the request ID; validation errors MUST also name the offending field(s).
- **FR-031**: Error taxonomy: 404 `not_found`, 405 `method_not_allowed`, 422 `validation_error`, 429 `rate_limited`, 500 `internal_error`, 503 `service_unavailable` / `not_configured`.
- **FR-032**: Error responses MUST NOT contain stack traces, SQL, database error text, file paths, or configuration values.

**Health and readiness**

- **FR-040**: `GET /health` MUST report liveness without contacting the database.
- **FR-041**: `GET /ready` MUST report ready only when the database is reachable and migrations are applied; otherwise 503.

**Seed data**

- **FR-050**: A single seed command MUST load exactly the sample records in the frontend mock files (`siteConfig`, departments, doctors, lab test categories, lab tests, health packages) plus the sample clinic rules, with every record marked as sample.
- **FR-051**: The seed MUST be idempotent: matched by slug (or the single settings record), it inserts missing records and restores sample records to the mock values, never creating duplicates.
- **FR-052**: The seed MUST refuse to run against a database configured as production.

**Security and privacy baseline (reused by all later features)**

- **FR-060**: Cross-origin access MUST be limited to an explicit allowlist of origins from configuration; no wildcard; disallowed origins receive no CORS headers.
- **FR-061**: Every response MUST include standard security headers (no content sniffing, frame denial, strict referrer policy, restrictive content security policy for API responses, and HSTS when served over HTTPS).
- **FR-062**: All public endpoints MUST be rate limited per client IP with a configurable limit (default 60 requests per minute); excess requests receive 429 with `Retry-After`. Liveness checks MAY be exempt.
- **FR-063**: Every request MUST get a request ID returned in a response header and included in its log entries.
- **FR-064**: Logs MUST be structured (one machine-readable record per event) and MUST NOT contain personal data, medical data, secrets, tokens, or full connection strings; query strings MUST NOT be logged raw.
- **FR-065**: Database connections MUST require SSL; credentials MUST come only from environment configuration. Only a placeholder example configuration file is committed; real configuration files are git-ignored.
- **FR-066**: Startup MUST fail with a clear message (without printing secrets) if required configuration is missing, if the application database URL is the direct (unpooled) URL, or if the test database equals the development or production database.
- **FR-067**: Every query and path parameter MUST be validated (length limits, allowed characters for slugs, enums for weekdays, numeric ranges for paging); unknown query parameters are ignored.

**Caching and performance**

- **FR-070**: Public catalog responses MUST carry `Cache-Control` (public, short max-age, configurable; default 5 minutes) and an `ETag`; a matching `If-None-Match` MUST return 304.
- **FR-071**: Health, readiness and error responses MUST NOT be cached.
- **FR-072**: Lookups by slug and by foreign reference MUST be indexed.

**Quality and developer experience**

- **FR-080**: Automated tests MUST cover unit logic and every endpoint (success, filters, pagination, 404, 422, 429, CORS, headers, ETag/304, error format, log redaction) and MUST run against a separate test database.
- **FR-081**: A test MUST apply all migrations up, then down to empty, then up again, on a scratch database.
- **FR-082**: Lint and static type checks MUST pass with no errors.
- **FR-083**: The README MUST explain how to set up and run the backend locally on Windows (CMD-friendly commands): install, configure, migrate, seed, run, test.

### Key Entities

- **ClinicSettings** (exactly one): name, tagline, full title, logo, brand colours, demo notice, emergency phone and general phone (display + dialable form), address lines, timezone, opening hours, lab hours, map area, credit line, indexable flag, sample flag.
- **ClinicRule**: text, display order, active flag, sample flag. Sample rules: arrive 15 minutes early; cancel at least 2 hours before; no-show policy after 3 missed visits; follow test preparation instructions; emergencies must call the emergency number, not book.
- **Department**: slug, name, summary, image, sort order, overview, conditions, services, related lab tests, active flag, sample flag.
- **Doctor**: slug, full name, department, specialty, photo (stored as a key that resolves to the `ImageAsset` shape), fee in PKR, qualifications, languages, experience years, bio, featured flag, active flag, sample flag.
- **DoctorWeeklySchedule**: doctor, weekday, start time, end time, slot length in minutes; times in the clinic timezone; start before end; no overlapping sessions for one doctor on one weekday.
- **LabTestCategory**: slug, name, icon name, sort order.
- **LabTest**: slug, name, also-known-as names, category, price in PKR, sample type, report time, preparation, home-collection flag, about, related departments, active flag, sample flag.
- **HealthPackage**: slug, name, icon name, who-for text, included lab tests (ordered), package price in PKR, preparation, home-collection flag, active flag, sample flag.

Every entity has a random non-guessable ID and created/updated timestamps with timezone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the sample records in the frontend mock files are returned by the API with identical field values (contract tests compare every field; the only differences allowed are the `id`/reference values and the additive fields).
- **SC-002**: A brand-new clinic can be served by loading different data only: changing the clinic name, phones and one rule in the database changes the API output with zero code changes.
- **SC-003**: For normal page sizes (up to 20 items), 95% of list and detail requests complete in under 200 ms measured at the backend against the development database.
- **SC-004**: Running the seed command 3 times in a row produces identical record counts and contents each time.
- **SC-005**: 0 responses in the test suite contain stack traces, SQL text or connection details, and 0 captured log lines contain secrets, full connection strings or raw query strings.
- **SC-006**: A client exceeding the per-IP limit receives 429 with `Retry-After` on 100% of excess requests in the rate-limit test.
- **SC-007**: A new developer on Windows can go from clone to a running backend serving seeded data in under 15 minutes by following the README.
- **SC-008**: All automated tests, migration up/down/up, lint and type checks pass.

## Constraints (set by the user and constitution)

- Backend lives in `backend/`; stack: FastAPI, SQLModel, Alembic, psycopg 3, run with `uv`; Neon Postgres (development database only in this feature).
- Application uses the pooled database URL; migrations use the direct URL (Constitution VII).
- Configuration only from environment variables; `.env` never committed; `.env.example` with placeholders committed.
- Commands documented for Windows CMD.

## Assumptions

- **IDs in responses**: the API returns the random internal ID as `id` (not the readable mock IDs such as `doc-hassan-mirza`). The frontend only compares IDs for equality, so Feature 004 needs no redesign; contract tests compare by slug.
- **Slot length**: the frontend `ScheduleSession` has no slot length. Sample sessions use 15 minutes, marked as sample; `slotMinutes` is an additive field. Slots themselves are not calculated in this feature.
- **Pagination envelope**: lists return `{ items, total, page, pageSize }`; each item matches the frontend type. Feature 004 unwraps `items`.
- **Lab test categories endpoint** (`GET /lab-test-categories`) is added beyond the user's list because the frontend's category filter and `categoryId` need it.
- **Clinic rules** are not in the frontend mock files; the seed adds the five example rules from the feature description, worded neutrally and marked as sample.
- **Logo and colours** are seeded with the existing brand values (navy `#0B2545`, teal `#14B8A6`) and the existing logo path.
- **Images**: photo/image keys resolve to the existing `/images/...` paths served by the frontend; no file storage is introduced.
- **Rate limit storage** is in-process for this feature (single instance); a shared store can replace it at deployment.
- **Cache period** of 5 minutes is acceptable for catalog data that changes rarely.
- **Health tips, FAQ, legal pages, about and home copy** stay in the frontend for now; they are editorial content, not catalog data.

## Dependencies

- The frontend mock files and types from Features 001–002 (`frontend/src/data/*.ts`, `frontend/src/types/content.ts`) are the reference for seed data and response shapes.
- A Neon development database and a separate test database, with pooled and direct URLs, provided by the user via environment configuration.

## Out of Scope

- Any write endpoint; authentication, sessions, OTP; booking, availability or slot calculation; notifications; file storage or uploads; staff app; admin UI for editing the catalog.
- Connecting the frontend to the API (Feature 004).
- Deployment, production database, and hosting configuration.
- Health tips, FAQ, legal and about content APIs.
