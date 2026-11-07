# Feature Specification: AI Agent v1 — Patient Assistant and Product Guide

**Feature Branch**: `010-ai-agent`
**Created**: 2026-11-07
**Status**: Draft (built in the unattended overnight run of 6–7 Nov 2026; owner review pending)
**Input**: User description: "AI Agent with two modes: patient mode (timings, doctors, departments, lab tests, fees, then guide to booking) and product-guide mode on the demo (explains to a clinic owner what the system includes and how it looks for their specialty). Answers only from the project's own data, never patient data. Version 1 with NO paid AI: a provider-agnostic agent interface plus a free built-in answer engine that matches questions to the project's own data and FAQs. A luxury chat widget, mobile-friendly, rate-limited, behind a feature flag that is OFF by default. Leave a clean slot to plug in a real AI provider later."

## Assumptions (agent decisions; also in `specs/QUESTIONS-FOR-SHUAIB.md`)

- A-1: **v1 runs entirely in the visitor's browser** over a small knowledge pack built from the site's own public data (departments, doctors, lab tests, packages, FAQ, opening hours, clinic settings) and product-guide notes. No server endpoint, no database, no API key, no cost. (ADR-0013)
- A-2: "Rate-limited" in v1 = a client-side limit (8 questions per minute, 60 per session) to stop runaway loops. Because no server is called, there is nothing to abuse server-side. A real provider later MUST go through the backend with the existing Postgres rate limiter (ADR-0006), never a browser key.
- A-3: Flag `ASSISTANT_ENABLED`, read at build time like `DEMO_ENABLED`; default **off** (missing = off). Product-guide mode additionally requires `DEMO_ENABLED`.
- A-4: The assistant never asks for, stores or sends personal or medical details. It does not give medical advice; symptom questions get a fixed safe reply pointing to a doctor, and emergency words get the clinic's emergency line (from clinic settings) and "call your local emergency number".
- A-5: Conversation lives only in component memory; nothing in `localStorage`, nothing logged, nothing sent anywhere.
- A-6: Widget code and knowledge pack are loaded only when the visitor opens the chat (lazy), so public page performance does not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Patient asks and is guided to booking (Priority: P1)

A patient taps the gold "Ask us" button, asks "When are you open?", "Which doctors do dermatology?", "How much is a CBC test?" or "Fee for Dr Ayesha". The assistant answers from the clinic's own data in one or two sentences, with links (doctor page, lab test page, booking with the doctor/department pre-selected) and quick-reply chips.

**Independent Test**: With the flag on, open the widget, ask "cbc price": the answer names the CBC test and its sample price in PKR from the catalog and offers a link to the lab test page.

**Acceptance Scenarios**:
1. **Given** the flag is on, **When** a visitor opens the widget, **Then** a greeting, a "Portfolio demo" note and 4 suggestion chips appear.
2. **Given** a question about timings, **Then** the opening hours from clinic settings are shown.
3. **Given** a doctor's name or department, **Then** the matching doctor(s) with department, fee and a "Book with …" link are shown.
4. **Given** a lab test or package name, **Then** its price and preparation/turnaround (when in the data) are shown with a link.
5. **Given** a question it cannot match, **Then** it says so honestly and offers contact/FAQ links — it never invents.
6. **Given** symptom or emergency words, **Then** the fixed safety reply is shown.
7. **Given** more than 8 questions in a minute, **Then** a calm "please wait a moment" message appears and input is paused.

### User Story 2 - Clinic owner explores the product (Priority: P2)

On the demo, the widget has a second tab "Product guide". A clinic owner asks "What do I get?", "Does it work for a dental clinic?", "Is there an admin dashboard?", "Can patients get a slip on WhatsApp?" and gets answers about the system with links to the specialty presets and the demo dashboard.

**Acceptance Scenarios**:
1. **Given** `DEMO_ENABLED` and the flag on, **Then** the "Product guide" tab is shown; with demo off it is absent.
2. **Given** "dental", **Then** it explains the Dental preset and links to `/demo/specialties/dental`.
3. **Given** "dashboard", **Then** it explains the Command Centre and links to the demo dashboard.

### User Story 3 - A real AI later, without rewriting (Priority: P3)

A developer can add a provider by implementing one interface (`AgentProvider.answer(request) → AgentReply`) and selecting it in one registry; the widget and tests do not change.

**Acceptance Scenarios**:
1. **Given** the registry, **Then** the only provider in v1 is `local` and the remote slot is documented but not wired.

### Edge Cases
- Empty or > 300-character questions are refused politely.
- Questions in Roman Urdu common words ("timing", "fees kitni", "doctor kaun") match key intents (small synonym list).
- Keyboard: open with Enter, close with Esc, focus returns to the button; screen readers hear new answers (`aria-live="polite"`).
- Mobile: full-height sheet, input stays above the keyboard, ≥ 44 px targets.

## Requirements *(mandatory)*

- **FR-001**: `AgentProvider` interface with `id`, `answer({ mode, question, history }) → Promise<AgentReply>`; `AgentReply` = text, optional links[], optional suggestions[].
- **FR-002**: `LocalAnswerEngine` implements it: normalise text, detect intent (hours, doctor, department, lab test, package, fee, booking, contact, location, emergency, symptom, product topics), score entities by token overlap, compose a reply from data only.
- **FR-003**: Knowledge pack built on the server from the existing cached loaders and passed to the lazy widget as JSON; contains public catalog fields only.
- **FR-004**: Widget: floating button bottom-right (above mobile safe area), dialog with tabs Patient / Product guide (demo only), messages, chips, input, "Portfolio demo — not medical advice" line. Navy/teal/gold, light + dark aware.
- **FR-005**: Client rate limit: 8 per rolling minute, 60 per page session.
- **FR-006**: Flag `ASSISTANT_ENABLED` default off; when off, no widget code is in the page.
- **FR-007**: No personal data asked, stored, logged or sent; no network calls by the engine.

## Success Criteria *(mandatory)*
- **SC-001**: ≥ 90% of a 40-question sample set (unit test) get the intended intent/entity.
- **SC-002**: Flag off: page output identical to today (no widget markup).
- **SC-003**: Lighthouse mobile unchanged (widget lazy).
- **SC-004**: axe: no violations with the widget open.

## Out of scope
Paid LLMs, server endpoint, conversation storage, bookings made inside the chat, Urdu script, voice.
