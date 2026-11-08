# Shuaib Health: feature list

A white-label clinic website + booking + staff dashboard. Portfolio demo with sample data.
Live demo: https://shuaib-health-web.vercel.app (noindex demo; share the link directly).

## Public clinic website
- Home, About, Departments (7), Doctors (9) with weekly schedules and fees, Lab tests (26) with preparation and report time, Health packages, Health tips, FAQ, Contact, Privacy, Terms.
- Mobile-first, light and fast (Lighthouse scores in `case-study.md`).
- Each doctor, department, lab test and tip has its own page and a generated social-share card.
- Contact page with an opt-in map (no map provider is contacted until the visitor presses "Show map").
- Accessibility: skip link, one `h1` per page, alt text on every photo, keyboard-friendly menus, axe checks in CI.
- SEO ready: titles, descriptions, canonical links, sitemap, structured data; one switch turns indexing on for a real clinic.

## Online booking
- Department → doctor → date → time → details, with real free slots from the server.
- Double booking blocked in the database; rate limits against abuse.
- Confirmation with a booking reference, PDF slip with QR code, print, calendar file and share link.
- Personal details masked on the slip and in links.

## Command Centre (staff dashboard)
- Today's agenda by doctor, live status flow (Arrived, In consultation, Done, No-show, Cancel) with undo.
- Search and filters with quick date ranges; upcoming bookings and "new" markers with a bell.
- Insights charts, doctors today, audit log, staff roles, printable day list.
- Light and night themes; works on phone and laptop.
- **One-click read-only demo** for visitors: sample data, nothing is saved.

## White-label presets
- The same system shown as a Dental, Skin & Aesthetic, Diagnostic Lab or Multi-speciality clinic.

## Assistant
- "Ask us" chat answering from the clinic's own data (timings, doctors, tests, fees); guides to booking. No AI key needed; off by default.

## Security and privacy
- Argon2 password hashing, secure cookies, CSRF and Origin checks, server-side roles, two-step sign-in (TOTP) for admins.
- Audit log, masked phone numbers, no personal data in logs or URLs, 7-day demo data purge.
- Content-Security-Policy and security headers, secret scanning (gitleaks), dependency audits.

## Engineering quality
- TypeScript strict (Next.js 16), Python 3.12 (FastAPI, SQLModel, Alembic), Postgres (Neon).
- 1,400+ unit tests, Playwright end-to-end, accessibility and visual tests in GitHub Actions CI.
- Hosted on Vercel (Singapore region), uptime monitoring, error tracking with personal data scrubbed, daily encrypted backups (runbook ready).
