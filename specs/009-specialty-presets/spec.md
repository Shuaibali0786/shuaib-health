# Feature Specification: "Choose your specialty" Demo Presets

**Feature Branch**: `009-specialty-presets`
**Created**: 2026-11-07
**Status**: Draft (built in the unattended overnight run of 6–7 Nov 2026; owner review pending)
**Input**: User description: "'Choose your specialty' demo presets: Dental, Skin & Aesthetic, Diagnostic Lab, Multi-speciality. A visitor switches presets on the demo and the name, colours, departments, doctors and images change. Demo only, behind the existing demo flag."

## Context

Shuaib Health is sold on Fiverr to clinics of different kinds. A dental clinic owner must see "a dental clinic website", not a general hospital. Today the demo shows one multi-speciality clinic. This feature adds a showcase where a visitor switches between four specialty presets and immediately sees the same product dressed for their specialty.

## Assumptions (agent decisions, owner unavailable; also in `specs/QUESTIONS-FOR-SHUAIB.md`)

- A-1: Presets are a **showcase page** (`/demo/specialties/<preset>`), not a re-skin of the whole live site. Re-skinning every page would need a per-request cookie (dynamic rendering: slower pages, lower Lighthouse) and a per-preset catalog in the database. The showcase is static, fast, and touches no existing page.
- A-2: Shown only when the existing `DEMO_ENABLED` flag is on; otherwise the routes answer 404. Pages are `noindex` and not in the sitemap (memory: demo clinic stays noindex).
- A-3: No new link is added to existing pages tonight (it would change every public visual baseline). The URL is shared directly (Fiverr gig, README). Where to link it from is a question for Shuaib.
- A-4: Images: reuse the repo's existing, already-cleared images (department photos and the hero photo). No new downloads. Preset doctors use **monogram avatars**, not the existing doctors' photos, so no photo is shown under a different person's name.
- A-5: All preset names are invented and marked "Sample clinic"; doctors are fictional with a "Sample" badge; contact details are `test@example.com` and `0300 1234567`.
- A-6: The booking, slip and dashboard parts of the showcase are **previews** (static, labelled "Preview") with a button to the real booking flow and the real demo dashboard. The real flows are not preset-aware in this version.
- A-7: Colours stay inside the brand family: each preset sets an accent from tokens (Dental teal, Skin & Aesthetic rose-gold, Diagnostic Lab blue, Multi-speciality navy + gold). New colour tokens go in `tokens.css` only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch specialty and see the clinic change (Priority: P1)

A clinic owner opens the showcase link. A switcher at the top shows Dental, Skin & Aesthetic, Diagnostic Lab and Multi-speciality. Choosing one changes the clinic name, tagline, accent colour, hero image, departments/services and doctors. The address changes (`/demo/specialties/dental`) so the owner can share the exact view.

**Why this priority**: The core "wow": the owner sees their own kind of clinic in seconds.

**Independent Test**: Open `/demo/specialties/dental`, then press "Skin & Aesthetic": the heading, the department names and the `data-preset` attribute change; the pressed tab has `aria-current="page"`.

**Acceptance Scenarios**:
1. **Given** demo is enabled, **When** a visitor opens `/demo/specialties`, **Then** they land on the Multi-speciality preset.
2. **Given** a preset page, **When** another preset is chosen, **Then** name, tagline, accent colour, hero image, services and doctors all change and the switcher marks the new one current.
3. **Given** an unknown preset id, **Then** the page is the normal 404.
4. **Given** `DEMO_ENABLED=false`, **Then** every showcase route is 404.
5. **Given** any preset, **Then** "Portfolio demo — not a real clinic, not medical advice." is visible and the clinic name carries a "Sample clinic" label.

### User Story 2 - See booking, slip and dashboard for that specialty (Priority: P2)

Below the clinic preview, three panels show how booking (service → doctor → time), the confirmation slip, and the Command Centre look for this specialty, each with a button to try the real thing.

**Independent Test**: On `/demo/specialties/diagnostic-lab`, the booking preview lists lab services, the slip preview shows the preset clinic name and a sample reference, and "Open the demo dashboard" links to `/admin/demo/start`.

**Acceptance Scenarios**:
1. **Given** a preset, **Then** the booking preview uses that preset's services and doctors.
2. **Given** a preset, **Then** the slip preview shows the preset's clinic name, a sample reference and `0300 1234567`.
3. **Given** the previews, **Then** each is labelled "Preview" and links to the real flow.

### Edge Cases
- Reduced motion: switching does not animate.
- No JavaScript: the switcher is plain links; everything works.
- Mobile 360 px: switcher scrolls horizontally without page overflow; targets ≥ 44 px.

## Requirements *(mandatory)*

- **FR-001**: Four presets (`dental`, `skin-aesthetic`, `diagnostic-lab`, `multi-speciality`) defined in one data module; each has name, short name, tagline, accent theme, hero image, 4–6 services, 3 doctors, opening hours text.
- **FR-002**: `/demo/specialties/[preset]` statically generated for the four ids; `/demo/specialties` redirects to `multi-speciality`.
- **FR-003**: Routes 404 when `DEMO_ENABLED` is off; pages are `noindex, nofollow` and excluded from the sitemap.
- **FR-004**: Switcher is a `nav` of links with `aria-current="page"`.
- **FR-005**: Theme applied by `data-preset` on the page wrapper and CSS custom properties; colours from `tokens.css` only.
- **FR-006**: Booking, slip and dashboard previews per preset, labelled "Preview", linking to `/book-appointment` and `/admin/demo/start`.
- **FR-007**: All copy honest: no ratings, awards, counts of patients; sample labels on clinic and doctors.
- **FR-008**: Existing pages, data and APIs are unchanged; one codebase — a preset is data, not copied code.

### Key Entities
- **Specialty preset**: id, label, clinicName, tagline, theme key, heroImage {src, alt}, services [{name, blurb, icon}], doctors [{name, role}], hours.

## Success Criteria *(mandatory)*
- **SC-001**: A visitor sees all four specialties within 4 clicks, each fully restyled.
- **SC-002**: Lighthouse mobile ≥ 90 on a preset page (static page, one priority image).
- **SC-003**: axe: no violations on preset pages (desktop + mobile).
- **SC-004**: All existing tests stay green; no existing visual baseline changes.

## Out of scope
Preset-aware real booking flow, preset-specific dashboard data, per-preset database catalog, admin UI to edit presets, linking from existing pages.
