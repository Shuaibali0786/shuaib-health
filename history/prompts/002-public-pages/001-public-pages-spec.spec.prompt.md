---
id: 001
title: Public Pages Spec
stage: spec
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.specify
labels: ["spec", "doctors", "departments", "lab-tests", "health-packages", "content-pages", "mock-data"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/002-public-pages/spec.md
 - specs/002-public-pages/checklists/requirements.md
tests:
 - none (specification only)
---

## Prompt

/sp.specify Feature 002: all remaining public pages of Shuaib Health with mock data (Phase 1, frontend only). Reuse the Feature 001 layout, design tokens, components and typed mock data layer (extend it, don't duplicate it). Keep every rule from the constitution: honesty, "Portfolio demo" notice, sample content labelled, PKR, Asia/Karachi, mobile-first, WCAG 2.2 AA, reduced motion, no backend calls, build never depends on an API.

Priorities (so we can implement and review in phases):

P1 — Doctors and Departments
- /doctors: list of 9 sample doctors (one per department, plus a second doctor for General Medicine and Pediatrics). Reuse the 4 existing doctor photos for 4 of them. Filter by department, search by name, filter by day available. Cards: photo, name, specialty, short qualifications, languages, fee (PKR), next available day, "Sample profile" label.
- /doctors/[slug]: profile with photo, specialty, qualifications, experience in years, languages (e.g. Urdu, English, Sindhi, Punjabi), consultation fee (PKR), weekly schedule table (days + time ranges, Asia/Karachi), short bio, department link, "Book appointment" button (goes to a "Booking coming soon" page for now).
- /departments: 7 departments (General Medicine, Cardiology, Pediatrics, Gynecology, Dermatology, Dental, Pathology Lab).
- /departments/[slug]: overview, common conditions treated, services offered, doctors in this department, related lab tests, "Book appointment" button.

P2 — Lab Tests and Health Packages
- /lab-tests: catalog with search and category filter (e.g. Blood, Diabetes, Heart, Liver, Kidney, Thyroid, Vitamins, Hormones, Urine). Each test: name, also-known-as, price (PKR), sample type, report time, preparation (e.g. 10–12 hours fasting), home collection yes/no. Details open in an accessible panel or a /lab-tests/[slug] page.
- /health-packages: 4–6 packages (e.g. Basic Health Check, Diabetes Care, Heart Check, Women's Health, Senior Citizen). Each: who it's for, included tests (linked to real catalog items), total price vs. sum of tests, preparation, home collection.
- All prices are realistic sample Karachi prices and clearly labelled as sample.

P3 — Content and trust pages
- /health-tips: article list with categories and reading time; /health-tips/[slug]: article page with sample content, "General information, not medical advice" note, related articles. At least 6 articles.
- /about: honest story of the demo clinic (mission, values, facility photos, how a visit works step by step). No fake history, awards, patient counts or accreditations.
- /contact: sample address, phones, emergency number, clinic hours (Mon–Sat 9 AM–9 PM, lab hours), map embed of the area that needs no API key, and a contact form with validation that clearly says messages are not sent in this demo yet.
- /faq: grouped accordion (Appointments, Lab tests & reports, Payments, Home sample collection, Privacy).
- /privacy and /terms: clear, readable pages written for this demo (what data the real app would collect, how health data is protected, roles, report access, cookies), with a "last updated" date and a note that this is a portfolio demo, not legal advice.

For every page
- Unique page title and meta description, Open Graph image, breadcrumbs on inner pages, sitemap and robots updated.
- Dynamic pages are statically generated from mock data; unknown slugs show the not-found page.
- All Feature 001 "Coming soon" links now point to real pages (except booking, login, My Appointments).
- Loading and empty states (e.g. "No doctors match your filters").
- Images: reuse the existing image set wherever possible (all 4 existing doctor photos, department photos, existing health tip photos, clinic photos). No watermarks, no other brands. Prefer icons over photos for lab test categories and packages.

New images list (required, at the end of the spec): a table of ONLY the new images I must add before implementation, with columns: image key, exact file name, folder under frontend/public/images, what it shows, gender (for doctors, matching the doctor's name), and 2–3 Pexels search terms (prefer South Asian / Pakistani people). Keep the list as short as possible.

Out of scope: booking flow, login/accounts, backend, staff app, AI chatbot.

## Response snapshot

Created branch `002-public-pages` and `specs/002-public-pages/spec.md`: 8 user stories (P1 doctors and departments, P2 lab tests and packages, P3 health tips, about, contact and FAQ, privacy and terms), edge cases, 70+ functional requirements, key entities, 10 success criteria, assumptions, out of scope, and a 7-row New Images table (5 doctor photos, 2 tip photos). Zero clarification markers; defaults documented (lab tests get own pages, map shown only after opt-in, indexing unchanged, home-sample-collection link goes to the FAQ group). Quality checklist passes.

## Outcome

- Spec ready for `/sp.clarify` or `/sp.plan`. User must add the 7 new images before implementation.
