# Feature Specification: Public Pages (Doctors, Departments, Lab Tests, Packages, Content and Trust Pages)

**Feature Branch**: `002-public-pages`  
**Created**: 2026-10-02  
**Status**: Draft  
**Input**: User description: "Feature 002: all remaining public pages of Shuaib Health with mock data (Phase 1, frontend only). Reuse the Feature 001 layout, design tokens, components and typed mock data layer (extend it, don't duplicate it). Keep every rule from the constitution. P1 Doctors and Departments; P2 Lab Tests and Health Packages; P3 Health Tips, About, Contact, FAQ, Privacy, Terms. Unique titles and descriptions, breadcrumbs, sitemap and robots, statically generated detail pages, loading and empty states, image reuse, and a short list of only the new images required. Out of scope: booking flow, login/accounts, backend, staff app, AI chatbot."

## Background

Feature 001 delivered the brand, the site header, notice bar and footer, and the Home page. Every other link on the site currently shows a "Coming soon" page. This feature replaces those pages with real, honest, sample-content pages so a visitor can browse the whole public site end to end. It is the second slice of Phase 1 (frontend with mock data, Constitution X) and is split into three review phases by priority: P1 Doctors and Departments, P2 Lab Tests and Health Packages, P3 Content and trust pages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the right doctor (Priority: P1)

A patient in Karachi opens "Doctors" and sees the nine sample doctors. They narrow the list by department, by typing part of a name, or by the weekday they can attend, then open a doctor's profile to read their qualifications, languages, fee and weekly schedule, and tap "Book appointment".

**Why this priority**: Finding a doctor is the main reason a patient visits a clinic site, and it is the first thing the Home page promises. Departments and the doctor profile are the base the later booking feature will build on.

**Independent Test**: With nothing else built, open `/doctors`, apply each filter and a search, open any profile, and press "Book appointment". Every step works and ends on a "Booking coming soon" page.

**Acceptance Scenarios**:

1. **Given** the Doctors page, **When** it loads, **Then** nine doctor cards are shown, each with photo, name, specialty, short qualifications, languages, fee in PKR, next available day, and a visible "Sample profile" label.
2. **Given** the list, **When** the visitor picks a department, types part of a name (any letter case, with or without "Dr."), or picks a weekday, **Then** only doctors matching all active filters remain and the visible count is announced to screen readers.
3. **Given** filters that match no doctor, **When** the list updates, **Then** the message "No doctors match your filters" appears with a "Clear filters" control that restores all nine doctors.
4. **Given** a doctor card, **When** the visitor opens it, **Then** the profile shows photo, specialty, qualifications, years of experience, languages, consultation fee in PKR, a weekly schedule table (days and time ranges, labelled Asia/Karachi), a short bio, a link to the doctor's department, and a "Book appointment" button.
5. **Given** a profile, **When** the visitor presses "Book appointment", **Then** they land on a "Booking coming soon" page in the normal site layout with a link back.
6. **Given** a doctor web address that does not exist, **When** it is opened, **Then** the standard not-found page is shown.

---

### User Story 2 - Explore departments (Priority: P1)

A patient who does not know which doctor they need opens "Departments", picks one of the seven, and reads what it treats, which services it offers, who works there, and which lab tests relate to it.

**Why this priority**: Departments are how most patients think ("I need a skin doctor"), and they connect doctors and lab tests, so they must exist together with doctors.

**Independent Test**: Open `/departments`, open each of the seven departments, and confirm each has at least one doctor linking to a valid profile, a related-tests list, and a working "Book appointment" button.

**Acceptance Scenarios**:

1. **Given** the Departments page, **When** it loads, **Then** seven department cards are shown (General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab) using the existing department photos.
2. **Given** a department page, **When** it loads, **Then** it shows an overview, common conditions treated, services offered, the doctors in that department (General Medicine and Pediatrics show two each), related lab tests linking to the lab-test pages, and a "Book appointment" button.
3. **Given** a department page, **When** the visitor follows a doctor or lab-test link, **Then** they reach a real page with a breadcrumb that leads back.

---

### User Story 3 - Browse lab tests and prepare correctly (Priority: P2)

A patient searches the lab test catalog for a test their doctor mentioned (for example by an alternative name), filters by category, and checks the price, sample type, report time, preparation (such as fasting) and whether home collection is available.

**Why this priority**: Lab tests are the second pillar of the clinic (the Home page promises it) but depend on departments for the "related tests" links.

**Independent Test**: Open `/lab-tests`, search "sugar" and "HbA1c", filter by each category, open a test's detail page, and verify all required fields and the sample-price label.

**Acceptance Scenarios**:

1. **Given** the catalog, **When** it loads, **Then** every test shows name, also-known-as names, price in PKR labelled as a sample price, sample type, report time, preparation, and home collection yes/no.
2. **Given** the catalog, **When** the visitor types a name or an also-known-as term, or picks a category (Blood, Diabetes, Heart, Liver, Kidney, Thyroid, Vitamins, Hormones, Urine), **Then** matching tests are listed, and "No lab tests match your search" with a clear-filters control appears when none match.
3. **Given** a test, **When** the visitor opens it, **Then** its own page shows the full details, its category, which health packages include it, and related departments, with breadcrumbs.

---

### User Story 4 - Compare health packages (Priority: P2)

A patient looks at the health packages, finds the one for their situation (for example Diabetes Care or Senior Citizen), sees exactly which tests it includes, and compares the package price with the sum of the individual test prices.

**Why this priority**: Packages are built from catalog tests, so they follow the catalog and add clear value for patients choosing a checkup.

**Independent Test**: Open `/health-packages`, check that each package's included tests link to real catalog pages and that "package price" and "sum of individual prices" are consistent with the catalog.

**Acceptance Scenarios**:

1. **Given** the Health Packages page, **When** it loads, **Then** five packages are shown (Basic Health Check, Diabetes Care, Heart Check, Women's Health, Senior Citizen), each stating who it is for, preparation, home collection yes/no, and a "sample price" label.
2. **Given** a package, **When** the visitor reads its tests, **Then** each test links to its catalog page, the sum of the individual test prices is shown beside the package price, and the difference is shown as an amount in PKR.
3. **Given** any package, **When** its numbers are checked, **Then** the displayed sum always equals the sum of the linked catalog prices, and the package price is never higher than that sum.

---

### User Story 5 - Read health tips (Priority: P3)

A visitor browses the health tips, filters by category, reads an article with its reading time, sees a clear note that it is general information, and moves on to related articles.

**Why this priority**: Content builds trust but does not block any task a patient needs to complete.

**Independent Test**: Open `/health-tips`, filter by each category, open every article, and confirm the general-information note and related articles appear and none is empty.

**Acceptance Scenarios**:

1. **Given** the Health Tips page, **When** it loads, **Then** at least six sample articles are listed with image, title, summary, category, reading time and a "Sample" label.
2. **Given** an article page, **When** it loads, **Then** it shows the full sample text, the note "General information, not medical advice", the published date in Asia/Karachi, and two or three related articles (same category first).
3. **Given** a category with no article, **When** selected, **Then** the empty state appears with a clear-filter control (the categories offered always have at least one article).

---

### User Story 6 - Understand who the clinic is and how a visit works (Priority: P3)

A visitor reads About to understand, honestly, what this demo clinic is, what it aims to do, the values behind it, and the steps of a typical visit from booking to report.

**Why this priority**: It supports trust, and Constitution I makes honesty the key point of this page.

**Independent Test**: Read `/about` and confirm it states plainly that this is a portfolio demo, includes mission, values, photos and a numbered visit flow, and contains none of the banned claims.

**Acceptance Scenarios**:

1. **Given** the About page, **When** it loads, **Then** it shows a mission, values, illustrative facility photos each labelled as illustrative, and a numbered "how a visit works" sequence.
2. **Given** the About page, **When** its text is scanned, **Then** it contains no invented founding date, history, awards, accreditations, certifications, patient counts, ratings or testimonials.

---

### User Story 7 - Reach the clinic and get answers (Priority: P3)

A visitor checks the sample address, phone numbers and opening hours, sees the area on a map, writes a message through the contact form, and reads grouped answers to common questions.

**Why this priority**: These pages answer practical questions but depend on no other feature.

**Independent Test**: Open `/contact`, submit the form empty, then invalid, then valid. Open `/faq`, expand and collapse each group by mouse and keyboard.

**Acceptance Scenarios**:

1. **Given** the Contact page, **When** it loads, **Then** it shows the sample address, general phone, emergency number, clinic hours (Monday to Saturday, 9 AM to 9 PM), lab hours, and a map of the surrounding Karachi area, all marked as sample or illustrative.
2. **Given** the contact form, **When** it is submitted with missing or invalid fields, **Then** each problem is described next to its field, the first problem receives focus, and nothing is sent.
3. **Given** a valid form, **When** it is submitted, **Then** a clear confirmation says that messages are not sent in this demo yet, no network request is made, and no data is stored.
4. **Given** the FAQ page, **When** it loads, **Then** questions are grouped under Appointments, Lab tests & reports, Payments, Home sample collection and Privacy, and each question opens and closes by mouse, touch and keyboard.
5. **Given** the Home page quick action for home sample collection, **When** it is followed, **Then** it opens the Home sample collection group of the FAQ page.

---

### User Story 8 - Read the privacy and terms pages (Priority: P3)

A visitor reads, in plain language, what data a real version of this app would collect and how it would be protected, and the rules for using the site, both clearly marked as demo text.

**Why this priority**: These pages are linked from the footer on every page and communicate the Constitution's privacy principles to visitors.

**Independent Test**: Open `/privacy` and `/terms`, and verify the "last updated" date, the demo and not-legal-advice notes, and that each required topic has its own heading.

**Acceptance Scenarios**:

1. **Given** the Privacy page, **When** it loads, **Then** it shows a "last updated" date and covers: what data a real app would collect, how health data would be protected, who can see what (patient, receptionist, doctor, lab staff, admin), how lab reports would be accessed, and cookies.
2. **Given** either page, **When** it loads, **Then** it states that it is a portfolio demo, not legal advice, and that this demo collects no personal data.

---

### Edge Cases

- A doctor, department, lab test or article web address with an unknown slug shows the not-found page (inside the site layout, with a way home); no placeholder or blank page.
- Search text with leading or trailing spaces, mixed case, or only "Dr." behaves sensibly: spaces are ignored; "Dr." alone does not hide every doctor.
- A search with special characters shows the empty state rather than an error.
- The "next available day" depends on today's date. It is always computed in Asia/Karachi (including near midnight and on Sunday, when no doctor sits) and, before it is computed or without scripting, the schedule table and a plain "Available Mon, Wed, Fri" fallback are shown instead of a wrong day.
- A doctor with only one weekly session, or a department with only one doctor, still renders cleanly.
- Filter results with one match, or with the full list, keep the layout stable (no layout jump when the list changes).
- A lab test is included in several packages, or in none; the test page lists the packages or omits that block.
- A package refers to a test that does not exist: this must be impossible, and a data check fails the build or tests rather than showing a broken link.
- The map cannot load (offline, blocked, or the visitor declines it): a text address and an open-in-maps text link remain, and the page does not break.
- Contact form: very long messages, whitespace-only fields, and phone numbers with spaces, dashes or the +92 prefix.
- Pages remain usable at 320 px width, with 200% text zoom, with keyboard only, and with reduced motion enabled.
- Images that fail to load show the existing graceful fallback rather than a broken icon.
- Old Feature 001 placeholder paths that no longer exist show the not-found page, not a stale "Coming soon".

## Requirements *(mandatory)*

### Functional Requirements

**Cross-cutting (all new pages)**

- **FR-001**: Every page MUST reuse the Feature 001 site layout (notice bar, header, footer, design tokens, shared components) and extend the existing typed content layer; no second copy of that data or those components is created.
- **FR-002**: Every page MUST show the site-wide notice "Portfolio demo — not a real clinic, not medical advice." and the footer credit, as required by the constitution.
- **FR-003**: All sample content (doctors, fees, prices, schedules, packages, articles, address, phones, hours, map position) MUST be visibly labelled as sample or illustrative where it appears. No reviews, ratings, testimonials, statistics, patient counts, awards, accreditations, certifications, registration numbers, real institutions' names, or other brands' names or logos may appear.
- **FR-004**: All prices MUST be in PKR with a consistent format, and all days and times in Asia/Karachi; pages that show times MUST say so.
- **FR-005**: Every page MUST have a unique title and meta description and a social-sharing (Open Graph) image; detail pages MUST describe their own subject.
- **FR-006**: Every page except Home MUST show a breadcrumb trail (for example Home › Doctors › Dr. Hassan Mirza), usable by keyboard and screen readers, with the current page marked.
- **FR-007**: Pages with detail slugs (doctors, departments, lab tests, health tips) MUST be generated ahead of time from the sample data, work without a running backend, and show the not-found page for unknown slugs.
- **FR-008**: The sitemap MUST list every real public page and every detail page; robots rules MUST follow the site's existing indexing setting (currently not indexable, so pages stay excluded from search engines, while the sitemap stays correct and ready).
- **FR-009**: Pages MUST NOT call any backend or third-party data service while loading, filtering or submitting forms, and the site build MUST succeed with no backend reachable. The only allowed external request is the optional map in FR-072, and only after the visitor chooses to show it.
- **FR-010**: Every list MUST have a designed empty state, and routes MUST show a loading placeholder (not a blank screen) while content is being prepared or while filters are being applied for the first time.
- **FR-011**: Layouts MUST be mobile-first and work from 320 px to wide desktop; interactive controls MUST meet WCAG 2.2 AA (visible focus, 24 × 24 px minimum targets, labelled fields, identified errors, sufficient contrast, status messages for result counts). Motion MUST be subtle and removed or reduced under the reduced-motion preference.
- **FR-012**: All Feature 001 links labelled "Coming soon" MUST now lead to real pages, except booking, login and My Appointments. The booking destination becomes a page titled "Booking coming soon" with a link back; the home sample collection link leads to the FAQ group of the same name; the old standalone "Coming soon" route for home sample collection is retired.
- **FR-013**: Cards and lists on new pages MUST use the existing card and badge look, including the "Sample" badge, so the pages feel like one site with Home.
- **FR-014**: Images MUST reuse the existing image set wherever possible; every image MUST have alt text, reserve its space to avoid layout shift, and fall back gracefully if it fails. Photos MUST carry no watermarks. Where a stock photo stands in for a person or facility, the page MUST say it is an illustrative or sample image.

**P1 — Doctors**

- **FR-020**: The Doctors page MUST list exactly nine sample doctors: one in each of the seven departments plus a second in General Medicine and a second in Pediatrics. The four existing doctor photos are reused for Dr. Hassan Mirza, Dr. Imran Qureshi, Dr. Sana Farooqui and Dr. Ayesha Rahman; the other five doctors use the new photos listed at the end of this spec.
- **FR-021**: Doctor cards MUST show photo, name, specialty, short qualifications, languages, consultation fee, next available day and the "Sample profile" label, and link to the profile.
- **FR-022**: The Doctors page MUST offer department filter, name search and day-available filter (Monday to Saturday), which combine with each other, show a result count, and can be cleared in one action. Filter choices MUST survive going back from a profile.
- **FR-023**: A doctor profile MUST show photo, specialty, qualifications, years of experience, languages (drawn from Urdu, English, Sindhi and Punjabi), consultation fee, a weekly schedule table, a short bio, a link to the department, and a "Book appointment" button. The schedule MUST list only days and time ranges inside clinic hours (Monday to Saturday, 9 AM to 9 PM) and be a real table that assistive technology reads by row and column.
- **FR-024**: Qualifications MUST use generic degree and fellowship titles only (for example MBBS, FCPS), and experience figures MUST be labelled sample; no named universities, hospitals, registration numbers or achievements appear.
- **FR-025**: "Next available day" MUST be derived from the doctor's schedule and today's date in Asia/Karachi, and must degrade as described in the edge cases.
- **FR-026**: "Book appointment" on doctor and department pages MUST lead to the "Booking coming soon" page; no booking data is collected.

**P1 — Departments**

- **FR-030**: The Departments page MUST list the seven existing departments with their existing photos and summaries, in the existing order.
- **FR-031**: A department page MUST show an overview, common conditions treated, services offered, its doctors, related lab tests, and a "Book appointment" button. Conditions and services are generic, are marked as a general list, and make no diagnosis or treatment claim.
- **FR-032**: Every department MUST have at least one doctor and at least three related lab tests (Pathology Lab shows its most common tests).

**P2 — Lab tests and packages**

- **FR-041**: The catalog MUST contain at least 24 sample tests covering all nine categories (Blood, Diabetes, Heart, Liver, Kidney, Thyroid, Vitamins, Hormones, Urine) with at least two tests in each category.
- **FR-042**: Each test MUST have name, also-known-as names, price (PKR, sample), sample type, report time, preparation instructions (for example "10–12 hours fasting" or "No preparation needed"), home collection yes/no, and category.
- **FR-043**: Prices MUST be realistic for Karachi, with single tests in roughly PKR 300–6,000, and each price display MUST be labelled as a sample price.
- **FR-044**: The catalog MUST support text search over names and also-known-as names and a category filter, combined, with a result count and an empty state.
- **FR-045**: Each test MUST have its own page with the same details, its category, the health packages that include it, and related departments; the catalog links each test to it.
- **FR-046**: Test text MUST be limited to logistics (what, how, when, preparation). It MUST NOT include result interpretation, reference ranges, diagnosis or treatment advice, and MUST advise visitors to follow their doctor's instructions on preparation.
- **FR-047**: The Health Packages page MUST show five packages (Basic Health Check, Diabetes Care, Heart Check, Women's Health, Senior Citizen), each with who it is for, included tests (each linked to a catalog test), the sum of individual test prices, the package price, the difference in PKR, preparation, and home collection yes/no.
- **FR-048**: For every package the displayed sum MUST equal the sum of the linked catalog prices and the package price MUST NOT exceed it; this is verified automatically. No percentage or promotional claims appear beyond the PKR difference.
- **FR-049**: Lab tests and packages MUST use icons (not photos) for categories and packages.

**P3 — Health tips**

- **FR-050**: There MUST be at least six sample articles with title, summary, category, publish date, reading time, image and body. The four existing tips (Staying hydrated, Healthy sleep habits, Balanced plate, Daily walk) are kept with their existing slugs and photos; two new articles are added with the new photos listed at the end.
- **FR-051**: The list MUST support filtering by category, and each article card shows category, reading time and the "Sample" label.
- **FR-052**: Reading time MUST be derived from the article text (rounded up to whole minutes, at least one minute).
- **FR-053**: Each article page MUST show body text of roughly 250–400 words in readable headings and paragraphs, the note "General information, not medical advice", and two or three related articles (same category first, then newest). Article text is general lifestyle information only, with no dosage, diagnosis or treatment claims.

**P3 — About, Contact, FAQ, Privacy, Terms**

- **FR-060**: The About page MUST contain the honest demo story, a mission, a values list, illustrative facility photos reused from the existing clinic and department images, and a step-by-step visit flow (find a doctor or test, book, visit or home collection, receive reports online, follow up).
- **FR-061**: The About page MUST NOT contain invented history, founding dates, awards, accreditations, certifications, staff or patient counts, or testimonials.
- **FR-070**: The Contact page MUST show the sample address, general phone, emergency number, clinic hours (Monday–Saturday 9 AM–9 PM), lab hours (a separate row), and a note that the demo numbers do not connect and that anyone with a real emergency must contact their local emergency services.
- **FR-071**: Phone numbers MUST be tappable on phones using the existing invalid sample numbers from the site configuration.
- **FR-072**: The Contact page MUST include a map of the general Karachi area that needs no account or key. It MUST be labelled "Map shows the general area; the address is a sample", MUST NOT pin a real business, and MUST load only after the visitor chooses to show it (the visitor is told an external map provider will be contacted), with a text address fallback always visible.
- **FR-073**: The contact form MUST collect name, phone or email, subject and message, validate each field with specific, plain messages (required fields, valid phone or email, message length limits), show errors next to fields and in a summary, move focus to the first error, and keep the visitor's text when errors appear.
- **FR-074**: A valid submission MUST show a confirmation that clearly says "Messages are not sent in this demo yet", MUST NOT make any network request, and MUST NOT store the entered data anywhere.
- **FR-075**: The form and its confirmation MUST be fully usable by keyboard and announced to screen readers.
- **FR-076**: The FAQ page MUST have five groups (Appointments, Lab tests & reports, Payments, Home sample collection, Privacy) with at least three questions each, answered as demo content consistent with the rest of the site (no claim that anything is live). Items MUST open and close by mouse, touch and keyboard, expose their state to assistive technology, work without scripting where possible, and each group MUST be addressable by a web address fragment.
- **FR-077**: The Privacy page MUST state the "last updated" date and cover: what data a real app would collect, how health data would be protected, the five roles and what each can see (a patient sees only their own data), how lab reports would be accessed (only by the owner and authorised staff, never through public links), and cookies. It MUST state that this demo collects no personal data and sets no tracking cookies.
- **FR-078**: The Terms page MUST state the "last updated" date and cover: the purpose of the demo, sample content, no medical advice, use of the site, bookings and payments not being live, and limits of responsibility, in plain language.
- **FR-079**: Privacy and Terms MUST each state that they are a portfolio demo and not legal advice.

### Key Entities

- **Doctor** (extends the Feature 001 record): name, department, specialty, photo, fee in PKR, qualifications, experience in years, languages, short bio, weekly schedule, sample flag. Belongs to exactly one department.
- **Weekly Schedule**: a list of sessions, each with a weekday and a start and end time in Asia/Karachi.
- **Department** (extends Feature 001): overview, common conditions, services offered, related lab test categories or tests. Has one or more doctors.
- **Lab Test**: name, also-known-as names, category, price in PKR, sample type, report time, preparation, home collection flag, sample flag.
- **Lab Test Category**: one of nine named categories, with an icon.
- **Health Package**: name, who it is for, list of lab tests, package price, preparation, home collection flag, icon, sample flag. Its total of individual prices is derived, never typed in.
- **Health Article** (extends Feature 001 health tip): body, category, publish date, derived reading time, related articles.
- **FAQ Group and Question**: group title, question, answer.
- **Legal Page Content**: sections, last-updated date.
- **Contact Message** (form input only): never sent and never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can go from the Home page to a specific doctor's profile in three taps or clicks or fewer, and find a doctor available on a chosen weekday in under 30 seconds.
- **SC-002**: Zero links on the site lead to a "Coming soon" page except the booking destination, and zero internal links lead to an error page; an automated check follows every link on every new page.
- **SC-003**: 100% of pages show the demo notice, a unique title and description, and (except Home) a breadcrumb; unknown detail addresses show the not-found page in 100% of the cases tested.
- **SC-004**: 100% of sample doctors, prices, packages, articles, and contact details carry a visible sample or illustrative label, and a content scan finds none of the forbidden claim words (for example rated, award, accredited, certified, patients served).
- **SC-005**: Package arithmetic is consistent: for all five packages the displayed sum equals the catalog sum and the package price is not higher, verified by an automated test.
- **SC-006**: Automated accessibility checks report no serious or critical violations on any new page at phone and desktop widths, and every feature works with the keyboard alone and with reduced motion enabled.
- **SC-007**: On a mid-range phone profile the new pages meet the constitution budgets (largest content shown within 2.5 s, no visible layout shift above 0.1) and filter changes show results within 200 ms.
- **SC-008**: The site builds successfully with no backend reachable, and the contact form, filters and searches make no network requests (verified by a test that blocks the network).
- **SC-009**: Every page is usable at 320 px width without sideways scrolling.
- **SC-010**: Every question on the FAQ and every required topic on Privacy and Terms can be found by a first-time reviewer in under 15 seconds using headings alone.

## Assumptions

- Sample data (nine doctors, seven departments, at least 24 tests, five packages, at least six articles, FAQ, legal text) is written for this feature and kept in the existing typed content layer; no real person, clinic, institution, product or price list is copied.
- New sample doctors: Dr. Maryam Baloch (Dermatology), Dr. Bilal Ansari (Dental), Dr. Zainab Memon (Pathology Lab), Dr. Omar Sheikh (General Medicine) and Dr. Faisal Chaudhry (Pediatrics). Names are invented and may coincide with real people, which is why every profile is labelled "Sample profile".
- Lab tests get their own pages (rather than a pop-up panel) so each is linkable, listed in the sitemap, and easy to make accessible. Health packages are shown on one page without separate detail pages.
- Lab hours for the sample: Monday–Saturday 8 AM–8 PM (sample collection ends 8 PM); the clinic hours are Monday–Saturday 9 AM–9 PM as specified. Both are labelled sample. No doctor sits on Sunday.
- The shared social-sharing image is a generated branded card with the page title, so no extra image file is needed.
- The current indexing setting (not indexable) is kept; making the demo indexable is a later, separate decision.
- "Book appointment" buttons link to the plain "Booking coming soon" page without passing a doctor or department; carrying that choice into booking belongs to the booking feature.
- The map uses a free, key-less map provider's embeddable view centred on the general Karachi area, shown only after the visitor opts in. If this is ever judged to conflict with "no external calls", the fallback is a static text address with an "open in maps" link.
- The demo itself sets no tracking or analytics cookies and stores nothing about visitors; the Privacy page statement in FR-077 must stay true and is verified.
- The old Feature 001 "Coming soon" test suites are updated to match the new pages in the same change; no existing visual design tokens change.

## Out of Scope

- The booking flow, availability, slots and payments (the "Booking coming soon" page is only a holding page).
- Login, accounts, My Appointments, report download.
- Any backend, database, staff app or AI chatbot.
- Real sending of contact messages.
- Result interpretation, medical advice, or real clinic content.
- Making the demo indexable by search engines.
- A shared header search, a site-wide search page, translations (Urdu, Sindhi) of the interface, and dark mode.

## New Images Required *(add before implementation)*

Only these seven images are new. Everything else reuses the existing set: all four existing doctor photos, the seven department photos, the four health-tip photos, `clinic/clinic-interior.jpg` (also reused with department photos as the About page's illustrative facility photos). Lab test categories and packages use icons, and the sharing image is generated, so neither needs a file.

Shared rules: photo must be free to use, with no watermark, no visible brand names or logos, and no identifiable patients; fit each file with `npm run images -- fit "<source>" <key>` as in the Feature 001 image manifest. Doctors: 600 × 750 px (4:5), face kept in the upper-middle; tips: 800 × 500 px (16:10).

| Image key | Exact file name | Folder under `frontend/public/images` | What it shows | Gender (doctors) | Pexels search terms |
|-----------|-----------------|----------------------------------------|---------------|------------------|----------------------|
| `dr-maryam-baloch` | `dr-maryam-baloch.jpg` | `doctors` | Smiling dermatologist in a white coat, head and shoulders, clinic background | Female | `South Asian woman doctor`, `Pakistani female doctor portrait`, `woman doctor white coat smiling` |
| `dr-bilal-ansari` | `dr-bilal-ansari.jpg` | `doctors` | Friendly dentist in scrubs or white coat, mask lowered, head and shoulders | Male | `South Asian dentist`, `male dentist portrait`, `Pakistani doctor man smiling` |
| `dr-zainab-memon` | `dr-zainab-memon.jpg` | `doctors` | Pathologist in a lab coat, head and shoulders, lab bench softly blurred behind | Female | `South Asian woman lab coat`, `female pathologist portrait`, `woman scientist laboratory smiling` |
| `dr-omar-sheikh` | `dr-omar-sheikh.jpg` | `doctors` | General physician in a white coat with stethoscope, clean-shaven or light stubble (distinct from Dr. Hassan Mirza and Dr. Imran Qureshi) | Male | `Pakistani male doctor`, `South Asian doctor stethoscope portrait`, `young male doctor white coat` |
| `dr-faisal-chaudhry` | `dr-faisal-chaudhry.jpg` | `doctors` | Warm, approachable pediatrician in a white coat, head and shoulders (no child, to keep consent simple) | Male | `South Asian pediatrician`, `male doctor friendly portrait`, `Pakistani doctor smiling` |
| `hand-hygiene` | `hand-hygiene.jpg` | `tips` | Hands being washed with soap under a running tap | n/a | `washing hands soap`, `hand hygiene sink`, `handwashing close up` |
| `managing-stress` | `managing-stress.jpg` | `tips` | Person sitting calmly by a window, breathing or relaxing with a cup of tea | n/a | `calm woman breathing window`, `relaxing at home tea`, `mindful breathing` |
