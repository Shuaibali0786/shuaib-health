# Feature Specification: Shuaib Health Brand, Site Layout and Home Page

**Feature Branch**: `001-brand-home-page`  
**Created**: 2026-09-30  
**Status**: Draft  
**Input**: User description: "Feature 001: Shuaib Health brand, site layout and Home page (Phase 1, frontend only, mock data). Patients in Karachi, mobile first. In 5 seconds a visitor should feel 'premium, calm, trustworthy clinic' and be able to find a doctor, book an appointment, see lab tests, or call emergency. Includes brand identity, a site-wide header/top notice/footer, and an 8-section Home page driven by typed mock data. Out of scope: other full pages, booking flow, backend, login."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First impression and clear next step (Priority: P1)

A patient in Karachi opens the site on a phone. Within seconds they see a calm, premium, light-themed page with the Shuaib Health brand, a clear headline, and two obvious actions: Book Appointment and Find a Doctor. They also see, without scrolling far, how to reach emergency help.

**Why this priority**: This is the whole purpose of the feature. If the first screen does not build trust and offer clear paths, nothing else matters.

**Independent Test**: Load the Home page at a 390 px wide viewport. Confirm the brand, headline, both primary buttons, and the emergency phone are visible or one tap away (menu) without any other page existing.

**Acceptance Scenarios**:

1. **Given** a visitor on a 390 px wide phone, **When** the Home page loads, **Then** the top notice bar, header with logo and Book Appointment access, hero headline, and both hero buttons are visible in the first screen.
2. **Given** a visitor on a desktop (≥ 1280 px), **When** the Home page loads, **Then** the full navigation, emergency phone, and Book Appointment button are visible in the header without opening a menu.
3. **Given** any visitor, **When** they view the hero, **Then** they see exactly three floating info cards containing only honest facts (opening hours, lab reports online, home sample collection) and no counts, ratings, or awards.

---

### User Story 2 - Navigate the whole site from anywhere (Priority: P1)

A visitor uses the sticky header (or the mobile hamburger menu) and the footer to move around. Every link works: pages that are not built yet show a simple "Coming soon" page instead of an error.

**Why this priority**: The layout appears on every page and every future feature depends on it. Broken links would undermine trust immediately.

**Independent Test**: Click every header, footer, and Home page link (including quick actions, department cards, doctor "View profile" and tip cards). None leads to an error page; unbuilt destinations show "Coming soon" with a way back Home.

**Acceptance Scenarios**:

1. **Given** a phone-width viewport, **When** the visitor opens the hamburger menu, **Then** all eight nav items (Home, About, Doctors, Departments, Lab Tests, Health Packages, Health Tips, Contact), the emergency phone, and Book Appointment are reachable, and the menu can be closed with the keyboard (Escape) and by tapping outside or on a close control.
2. **Given** the visitor scrolls down the page, **When** they look at the top of the screen, **Then** the header remains visible (sticky) and does not cover focused content.
3. **Given** a link to a page not yet built, **When** the visitor follows it, **Then** they see a "Coming soon" page in the same site layout with a link back to Home.
4. **Given** the visitor reaches the footer, **When** they read it, **Then** they see four columns (brand and intro, Quick links, Departments, Contact) and a bottom row with copyright, Privacy, Terms, and "Designed & built by Shuaib Ali" linking to https://github.com/Shuaibali0786.

---

### User Story 3 - Understand honesty of the demo (Priority: P1)

A visitor is never misled. Every page shows the notice "Portfolio demo — not a real clinic, not medical advice." Sample doctors, fees, addresses, phone numbers, and articles are clearly labelled as sample content. No reviews, ratings, patient counts, awards, certifications, or third-party brand names or logos appear anywhere.

**Why this priority**: This is a non-negotiable project principle (Constitution I). It is also what makes a fictional clinic ethical to publish.

**Independent Test**: Visit every route and read the top bar; scan the Home page for the words rating, review, award, certified, accredited, patients served; confirm every sample doctor card and sample article is marked.

**Acceptance Scenarios**:

1. **Given** any page including "Coming soon" pages, **When** it loads, **Then** the top notice bar shows exactly "Portfolio demo — not a real clinic, not medical advice."
2. **Given** the Featured Doctors section, **When** the visitor views a doctor card, **Then** it visibly carries a "Sample" label.
3. **Given** the Health Tips section, **When** the visitor views an article card, **Then** it is visibly marked as sample content.
4. **Given** the Contact column in the footer, **When** it is read, **Then** the address and phone are shown as sample details.

---

### User Story 4 - Find a doctor, department, lab tests or emergency help from the Home page (Priority: P2)

From the Home page a visitor can jump into what they came for: "How can we help you?" quick actions (Find a Doctor, Book Appointment, Lab Tests, Health Packages, Home Sample Collection), seven department cards, featured doctor cards, and an Emergency card with the emergency number and "go to the nearest ER" advice.

**Why this priority**: These sections turn the good first impression into task completion, but they depend on the layout and honesty rules above.

**Independent Test**: On the Home page, use each quick action, department card, doctor "View profile" and the emergency card; each leads to the intended destination (or its "Coming soon" page) and the emergency number is a tappable call link on phones.

**Acceptance Scenarios**:

1. **Given** the "How can we help you?" section, **When** viewed, **Then** it shows five actions in the stated order, each linking to its destination.
2. **Given** the Departments section, **When** viewed, **Then** it shows exactly seven cards (General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab), each with an image, name, one-line description and link.
3. **Given** the Featured Doctors section, **When** viewed, **Then** it shows 3 or 4 cards each with photo, name, specialty, consultation fee in PKR, and a "View profile" link.
4. **Given** the Emergency card, **When** a visitor on a phone taps the number, **Then** the phone's dialer opens with that number; the card also advises going to the nearest emergency room.
5. **Given** the Honest facts band, **When** viewed, **Then** it shows only true-for-the-demo facts (7 departments, reports online, opening hours in Asia/Karachi time, same-day lab reports for common tests).

---

### User Story 5 - Comfortable, accessible experience for everyone (Priority: P2)

A visitor using a keyboard, screen reader, low-vision settings, or a slow phone connection can use the site. Motion is subtle and turns off for people who prefer reduced motion.

**Why this priority**: Accessibility and speed are project requirements (Constitution VIII) and affect all users on mobile.

**Independent Test**: Tab through the Home page using only the keyboard; run an automated accessibility scan; emulate "reduce motion"; load on a throttled mobile connection.

**Acceptance Scenarios**:

1. **Given** keyboard-only use, **When** the visitor presses Tab from the top of the page, **Then** a "Skip to main content" link appears first, focus is always visible, and the order follows the visual order through header, content, and footer.
2. **Given** the operating system is set to reduce motion, **When** the page loads and scrolls, **Then** entrance and hover animations are removed or reduced to simple fades with no movement.
3. **Given** any text and interactive element, **When** measured, **Then** contrast meets WCAG 2.2 AA (4.5:1 for normal text, 3:1 for large text and UI components).
4. **Given** a mid-range phone on a typical mobile connection, **When** the Home page loads, **Then** the main content is visible quickly and the layout does not jump as images load.

---

### Edge Cases

- **Very narrow screens (320 px)**: no horizontal scrolling; header, buttons and cards remain usable; text can be enlarged to 200% without loss of content.
- **Wide screens (≥ 1920 px)**: content stays within a comfortable maximum width and remains centered.
- **A placeholder image fails to load**: the card keeps its size, shows a neutral background and readable alt text; no broken-image icon.
- **JavaScript is slow or unavailable for the menu**: the primary content and footer links remain reachable; the Home page content still renders.
- **Long doctor names or specialties, or long tip titles**: text wraps or truncates gracefully without breaking card layout.
- **Unknown URL (true 404)**: the visitor sees a friendly not-found page in the site layout with a link Home (distinct from "Coming soon"). Links inside the site must never lead here.
- **Opening hours and the visitor's timezone**: hours are always labelled as Karachi time (PKT), even for visitors elsewhere.
- **Phone number on desktop**: the emergency number is readable text and also a tap-to-call link; nothing breaks when a device cannot place calls.
- **Mock data missing a field (for example, a doctor with no photo)**: the card falls back to a neutral placeholder rather than failing the page.

## Requirements *(mandatory)*

### Functional Requirements

**Brand**

- **FR-001**: The site MUST present the name "Shuaib Health — Clinic & Diagnostics, Karachi" and an original logo: a rounded plus sign filled with a teal-to-navy gradient, with a white heartbeat line through it that forms an "S", beside a wordmark with "Shuaib" in navy and "Health" in teal.
- **FR-002**: The logo MUST be original and MUST NOT resemble or include any other organization's brand, name, or logo. It MUST have accessible alternative text and work on light backgrounds at header size and larger.
- **FR-003**: The visual style MUST be premium, calm, and light: navy #0B2545 for headings, teal #14B8A6 for accents with teal-to-blue gradients, a blue accent, light backgrounds, rounded cards, and soft shadows. Colors MUST be defined once and reused, not repeated ad hoc across pages.

**Site-wide layout (on every page, including "Coming soon" and not-found pages)**

- **FR-004**: Every page MUST show a thin top notice bar with exactly the text "Portfolio demo — not a real clinic, not medical advice."
- **FR-005**: Every page MUST show a sticky header containing the logo (linking to Home), navigation items Home, About, Doctors, Departments, Lab Tests, Health Packages, Health Tips and Contact, the emergency phone number (tap-to-call), and a "Book Appointment" button.
- **FR-006**: On small screens the navigation MUST collapse into a hamburger menu that opens and closes by touch and keyboard, exposes its state to assistive technology, returns focus to its trigger when closed, and keeps the emergency phone and Book Appointment reachable.
- **FR-007**: The header MUST indicate the current page in navigation.
- **FR-008**: Every page MUST show a four-column footer: (1) brand and a short intro, (2) Quick links, (3) Departments, (4) Contact with a sample Karachi address, a sample phone number, and opening hours labelled as Asia/Karachi time. Columns stack on small screens.
- **FR-009**: The footer bottom row MUST show a copyright line, links to Privacy and Terms, and the text "Designed & built by Shuaib Ali" linking to https://github.com/Shuaibali0786.
- **FR-010**: Every page MUST provide a "Skip to main content" link and a single main content landmark.

**Home page (sections in this exact order)**

- **FR-011 Hero**: MUST show a headline, short supporting text, a "Book Appointment" button, a "Find a Doctor" button, a doctor photo, and exactly three floating info cards with honest facts only (for example: "Open Mon–Sat, 9 AM – 9 PM", "Lab reports online", "Home sample collection").
- **FR-012 Quick actions**: MUST show a section titled "How can we help you?" with five actions in order: Find a Doctor, Book Appointment, Lab Tests, Health Packages, Home Sample Collection.
- **FR-013 Departments**: MUST show exactly seven cards in order (General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab), each with photo, name, one-line description and a link.
- **FR-014 Honest facts band**: MUST show only facts that are true within the demo: 7 departments, lab reports available online, opening hours in Asia/Karachi time, same-day lab reports for common tests. It MUST NOT show patient counts, years of experience, awards, certifications, accreditations, or ratings.
- **FR-015 Why choose us**: MUST show 4 to 5 reasons next to a clinic interior photo, plus an Emergency card with the emergency phone number (tap-to-call) and advice to go to the nearest emergency room.
- **FR-016 Featured doctors**: MUST show 3 or 4 doctor cards, each with photo, name, specialty, consultation fee in PKR, a visible "Sample" label, and a "View profile" link.
- **FR-017 Health tips**: MUST show exactly 3 latest article cards (image, title, short summary, date), each visibly marked as sample content and linking to its destination.
- **FR-018 CTA band**: MUST close the page with a call-to-action band containing the heading "Book your appointment" and a button leading to the booking destination.

**Content and data**

- **FR-019**: All doctor, department, and health-tip content MUST come from typed mock data sources kept separate from presentation, using shapes (fields and types) that a future backend can supply unchanged. Page components MUST NOT contain hard-coded doctor, department, or tip content.
- **FR-020**: Fees MUST be shown in PKR (for example "PKR 2,500"), and all displayed times or hours MUST be labelled as Karachi time.
- **FR-021**: The site MUST contain no fake reviews, ratings, testimonials, statistics, awards, certifications, or other brands' names or logos. Sample content MUST be visibly labelled as sample.
- **FR-022**: Images MUST be clearly named placeholders (file names identify subject and purpose), free of watermarks and third-party branding, each with meaningful alternative text, and easy to replace with real photos later without changing page code.
- **FR-023**: If any mock data item lacks an image, the interface MUST show a neutral fallback and keep layout stable.

**Navigation integrity**

- **FR-024**: Every internal link on the site MUST resolve. Destinations that are not built in this feature (About, Doctors, doctor profiles, Departments, department pages, Lab Tests, Health Packages, Health Tips, article pages, Contact, Book Appointment, Home Sample Collection, Privacy, Terms) MUST show a "Coming soon" page in the standard layout with a link back to Home.
- **FR-025**: URLs that do not correspond to any site link MUST show a friendly not-found page in the standard layout.

**Accessibility, motion, and performance**

- **FR-026**: The site MUST be usable on screens from 320 px wide up, designed mobile-first, with no horizontal scrolling and readable text at 200% zoom.
- **FR-027**: All functionality MUST be operable by keyboard with a visible focus indicator, and interactive targets MUST be at least 24 × 24 CSS px with adequate spacing (WCAG 2.2 AA).
- **FR-028**: Text and UI component contrast MUST meet WCAG 2.2 AA. Information MUST NOT be conveyed by color alone.
- **FR-029**: Animations MUST be subtle (gentle fades and slight movement on entrance or hover) and MUST be removed or reduced to non-moving effects when the user prefers reduced motion.
- **FR-030**: Images below the first screen MUST load lazily, images MUST reserve their space to prevent layout shift, and the first-screen hero image MUST load with priority.
- **FR-031**: The site MUST build and run with no backend available; this feature has no dependency on any server or network call for content.
- **FR-032**: The page MUST use a semantic heading structure (one main heading, sections with their own headings) and each image, icon-only control, and landmark MUST have an accessible name.

### Key Entities *(include if feature involves data)*

- **Department**: A clinical or lab specialty. Attributes: unique identifier, URL-friendly name, display name, one-line description, image (with alternative text), link destination.
- **Doctor**: A clinician shown as a sample. Attributes: unique identifier, URL-friendly name, full name, specialty (references a Department), photo (with alternative text), consultation fee in PKR, "sample" flag, profile link.
- **Health Tip (article)**: A sample article summary. Attributes: unique identifier, URL-friendly name, title, short summary, publication date, category, image (with alternative text), "sample" flag, link destination.
- **Site contact and hours**: Clinic display details shown in header and footer. Attributes: emergency phone (sample), general phone (sample), address (sample), opening hours (days and times in Asia/Karachi).
- **Navigation item**: Label and destination for header, footer quick links, and footer departments (shared source so lists never drift apart).

## Assumptions

- All contact details (phone numbers, address, email) are invented and displayed as sample; they must not be real, working, or belong to any real organization. The emergency number is a clearly fake sample number, and the emergency card also tells visitors to go to the nearest ER for real emergencies.
- Sample doctors have invented names, fees, and placeholder photos. No sample doctor is described with credentials, ratings, or years of experience.
- Opening hours: Monday to Saturday, 9 AM to 9 PM Karachi time, closed Sunday (taken from the description's example). Lab and emergency-care availability outside these hours is not claimed.
- The "Book Appointment", "Find a Doctor", "Lab Tests", "Health Packages" and "Home Sample Collection" actions lead to "Coming soon" pages in this feature; the real destinations arrive in later features. Link destinations should already use their final URLs so nothing changes later.
- Privacy and Terms are "Coming soon" pages in this feature.
- Copyright line uses the brand name and the current year; it makes no claim of a registered organization.
- Home page copy (headline, support text, "why choose us" points, tips) is written in English only; localization (for example Urdu) is out of scope for this feature.
- The site is light-theme only; no dark mode in this feature.
- Traffic is mostly mobile: layouts are designed for a 390 px phone first, then tablet and desktop.
- Success measurements use a mid-range mobile profile on a typical mobile connection as the reference device.

## Out of Scope

- Full About, Doctors list/profile, Departments list/detail, Lab Tests, Health Packages, Health Tips list/article, and Contact pages (placeholders only).
- The booking flow, availability, payments, and any patient or staff login.
- Any backend, API, database, analytics, or cookies/consent tooling.
- Real photography, real contact details, and real clinical content.
- Dark mode and languages other than English.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a 5-second first-look test on a 390 px phone, at least 4 out of 5 reviewers can name at least three ways to act (book, find a doctor, lab tests, emergency) and describe the clinic as calm and professional. (Qualitative review on the finished build.)
- **SC-002**: On a 390 px wide screen, the brand, headline, both hero buttons, and the header's Book Appointment access are visible without scrolling, and the emergency number is reachable within one tap.
- **SC-003**: 100% of internal links found on the Home page, header, and footer resolve to a working page (built or "Coming soon"); zero links lead to a not-found page.
- **SC-004**: 100% of pages show the exact demo notice, and 100% of pages show the "Designed & built by Shuaib Ali" credit with the correct link in the footer.
- **SC-005**: A text scan of all pages finds zero occurrences of fabricated claims (ratings, reviews, awards, certifications, accreditations, patient counts) and zero third-party brand names or logos.
- **SC-006**: An automated accessibility scan of the Home page and "Coming soon" page reports zero serious or critical WCAG 2.2 AA violations, and a keyboard-only user can reach and activate every interactive element in a logical order.
- **SC-007**: With "reduce motion" enabled, no element on the page moves or animates in position or scale.
- **SC-008**: On a mid-range mobile profile, the main content is visible within 2.5 seconds, the page reacts to taps within 200 ms, and layout shift stays at or below 0.1.
- **SC-009**: The site builds and every page renders correctly with no backend running or reachable.
- **SC-010**: Replacing the content of any mock data source (doctors, departments, tips) with another set of the same shape changes the Home page content with no edits to page presentation.
