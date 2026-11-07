# Case study: Shuaib Health — clinic website, online booking and staff dashboard

*Portfolio demo with sample data. Designed and built by Shuaib Ali.*
Live demo: https://shuaib-health-web.vercel.app · Screenshots: [`screenshots/`](screenshots/)

## The problem
Small clinics in Pakistan, the Gulf and the UK still take most bookings by phone and WhatsApp. Patients cannot see
which doctor is in on which day, what a test costs or whether to fast first. Front-desk staff juggle paper lists,
double bookings and no-shows, and clinic owners have no simple view of the day. Off-the-shelf hospital software is
expensive and slow; generic website builders cannot book real time slots safely.

## The solution
One white-label system a clinic can brand in a day:
- **A fast public website**: doctors with weekly schedules and fees, departments, 26 lab tests with preparation and report times, health packages, tips, FAQ and contact.
- **Online booking in four steps** (department → doctor → date/time → details) using real free slots from the server, with a PDF slip, QR code, calendar file and share link.
- **The Command Centre** for staff: today's agenda by doctor, one-tap status changes with undo, search, upcoming bookings with a "new" bell, insights, audit log, roles and a printable day list.
- **Specialty presets**: the same system as a Dental, Skin & Aesthetic, Diagnostic Lab or Multi-speciality clinic.
- **A one-click read-only demo** so a prospective client can try the dashboard without an account.

Full list: [`feature-list.md`](feature-list.md).

## Tech stack
| Layer | Choice | Why |
|---|---|---|
| Website and staff app | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4 | Server rendering for speed and SEO; one codebase for site and dashboard |
| API | Python 3.12, FastAPI, SQLModel, Alembic | Typed contracts (OpenAPI), clean migrations |
| Database | Postgres on Neon (Singapore) | Constraints block double booking at the database level |
| Hosting | Vercel (Singapore region), serverless functions | Low latency for South Asia and the Gulf; zero servers to patch |
| Quality | Vitest (1,600+ unit tests), Playwright end-to-end, axe accessibility checks, visual tests, GitHub Actions CI | Every change is tested before it ships |
| Operations | Uptime monitoring, Sentry with personal data scrubbed, gitleaks, dependency audits, encrypted daily backups (runbook) | Production habits from day one |

## Security and privacy
- Argon2 password hashing, secure HTTP-only cookies, CSRF and Origin checks, roles enforced on the server.
- Two-step sign-in (authenticator app + backup codes) for administrators.
- Rate limits and lockouts stored in Postgres (work correctly on serverless), honeypot field and per-phone limits on booking.
- Phone numbers masked in the dashboard, on the slip and in share links; no personal data in URLs or logs; audit log of staff actions.
- Content-Security-Policy and security headers; staff pages are `noindex` and never cached.
- Demo data is purged automatically after 7 days.

## Speed and quality scores
Lighthouse 12.6.1 on the live site, 7 Nov 2026, **65 public pages**, mobile (simulated slow 4G) and desktop:

| | Performance | Accessibility | Best Practices |
|---|---|---|---|
| Mobile | **95–99** (median 98) | **98–100** | **100** |
| Desktop | **100** on every page | **98–100** | **100** |

Largest Contentful Paint: at most 2.6 s on mobile and 0.5 s on desktop; layout shift ≈ 0.
SEO scores are deliberately held down because the demo clinic is set to `noindex` (it is not a real clinic);
titles, descriptions, canonical links, sitemap and structured data are all in place, and one switch turns indexing on.
Details: [`../reports/site-audit-2026-11-07/README.md`](../reports/site-audit-2026-11-07/README.md).

## Results for a clinic
- Patients book 24/7 without calling, and get a slip with the reference, time and a calendar file.
- Staff see the whole day on one screen and update a booking in one tap.
- The owner sees trends (bookings, no-shows, busiest doctors) without spreadsheets.

## What I can build for you
Your clinic's branded site and booking system, adapted to your specialty, languages and workflow, deployed and
handed over with documentation and tests.
