---
id: 001
title: Brand and Home Page Spec
stage: spec
date: 2026-09-30
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: /sp.specify
labels: ["spec", "brand", "layout", "home-page", "mock-data", "accessibility"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-brand-home-page/spec.md
 - specs/001-brand-home-page/checklists/requirements.md
 - history/prompts/001-brand-home-page/001-brand-and-home-page-spec.spec.prompt.md
tests:
 - none (specification only)
---

## Prompt

/sp.specify Feature 001: Shuaib Health brand, site layout and Home page (Phase 1, frontend only, mock data).

Who: patients in Karachi on mobile first (most traffic), also desktop. Goal: in 5 seconds a visitor feels "premium, calm, trustworthy clinic" and can find a doctor, book an appointment, see lab tests, or call emergency.

Brand: "Shuaib Health — Clinic & Diagnostics, Karachi". Original logo: rounded plus sign in a teal-to-navy gradient with a white heartbeat line through it that forms an "S"; wordmark "Shuaib" navy + "Health" teal. Colors: navy #0B2545, teal #14B8A6, blue accent, light backgrounds, soft shadows, rounded cards.

Site layout (on every page):
- Sticky header: logo, nav (Home, About, Doctors, Departments, Lab Tests, Health Packages, Health Tips, Contact), emergency phone, "Book Appointment" button. Mobile: hamburger menu.
- Thin top notice bar: "Portfolio demo — not a real clinic, not medical advice."
- 4-column footer: brand + short intro, Quick links, Departments, Contact (sample Karachi address, sample phone, hours in Asia/Karachi). Bottom row: copyright, Privacy, Terms, and "Designed & built by Shuaib Ali" linking to https://github.com/Shuaibali0786.

Home page sections, in order:
1. Hero: headline + short text, "Book Appointment" and "Find a Doctor" buttons, doctor photo, 3 small floating info cards with honest facts only (e.g. "Open Mon–Sat, 9 AM – 9 PM", "Lab reports online", "Home sample collection").
2. "How can we help you?" quick actions: Find a Doctor, Book Appointment, Lab Tests, Health Packages, Home Sample Collection.
3. Departments: 7 cards with photo, name, one line, link — General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab.
4. Honest facts band: things that are true for the demo (7 departments, reports online, Asia/Karachi hours, same-day lab reports for common tests). NO patient counts, awards, certifications or ratings.
5. Why choose us (4–5 points) next to a clinic interior photo, plus an Emergency card with the emergency number and "go to the nearest ER" advice.
6. Featured doctors: 3–4 cards (sample doctors clearly marked as sample): photo, name, specialty, fee in PKR, "View profile".
7. Health Tips: 3 latest article cards (sample content).
8. CTA band: "Book your appointment" button.

Rules:
- All content comes from typed mock data files (doctors, departments, tips) so the backend can replace them later with the same shapes.
- Images: use clearly named placeholder images for now; real photos will be added later. No watermarks, no other brands' names.
- Mobile-first, keyboard accessible, WCAG 2.2 AA contrast, subtle animations that respect reduced motion, fast load.
- Links to pages that don't exist yet go to simple "Coming soon" placeholders, never 404.
- Out of scope: other full pages, booking flow, backend, login.

## Response snapshot

Created branch `001-brand-home-page` and wrote `specs/001-brand-home-page/spec.md`: 5 prioritized user stories, edge cases, 32 functional requirements (brand, layout, 8 Home sections, data, link integrity, a11y/motion/performance), key entities, assumptions, out-of-scope, and 10 measurable success criteria. Quality checklist passes; zero NEEDS CLARIFICATION markers.

## Outcome

- ✅ Impact: Feature 001 spec ready for /sp.clarify or /sp.plan.
- 🧪 Tests: none (spec only); acceptance scenarios and SC-001–SC-010 define future tests.
- 📁 Files: spec.md, checklists/requirements.md, this PHR.
- 🔁 Next prompts: /sp.clarify (optional) then /sp.plan for Feature 001.
- 🧠 Reflection: create-new-feature.ps1 created branch and spec file but printed a parameter error in the tool wrapper; verified state manually and did not rerun.

## Evaluation notes (flywheel)

- Failure modes observed: script reported "positional parameter 'prompts'" error after creating branch/spec; create-phr.sh not present.
- Graders run and results (PASS/FAIL): spec quality checklist PASS (all items).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): pass description through a file to avoid shell quoting issues.
