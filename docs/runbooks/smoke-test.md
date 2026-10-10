# Live smoke test

Run after every production deploy, on desktop, and once on a real phone on mobile data. Read-only: do not create bookings on the live demo except where a step says so. Record the result as `specs/007-launch-ready/results/smoke-<date>.md` (pass/fail per line, no personal data).

| # | Check | Pass when |
|---|---|---|
| 1 | Home page | Loads, no console errors, no `localhost` anywhere |
| 2 | A catalog page (for example a doctor profile) | Real data shows; no "temporarily unavailable" notice |
| 3 | Booking end to end | Pick a doctor and a slot, confirm: a booking reference and the slip appear (use a made-up phone number; the demo clears it) |
| 4 | Demo dashboard | The one-click demo opens the Command Centre with sample data and the demo notice |
| 5 | Admin sign-in page | `/admin/login` shows the sign-in form and is `no-store` and `noindex` |
| 6 | Robots and noindex | `/robots.txt` disallows everything and pages carry `noindex` while the clinic is not indexable |
| 7 | No localhost | `canonical`, `og:url`, `/sitemap.xml` and `/robots.txt` hold only `https://` addresses of the live site |
| 8 | Website and API agree on the demo switch | Both have `DEMO_ENABLED=true`: the demo button works; with it off it is not offered |
| 9 | Security headers | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` on `/`, a catalog page and `/admin/login`; the CSP is report-only (`SITE_SECURITY_HEADERS=report`) or enforced (`enforce`); `/admin/login` keeps its own `Content-Security-Policy: frame-ancestors 'none'` |
| 10 | `/health` | API answers 200 `{"status":"ok"}` |
| 11 | `/ready` | API answers 200 (this wakes the database) |
| 12 | No sales copy | No price outside a "sample" label, no "hire us" or "buy" call to action |

## Phone pass (🔑 owner)
Repeat 1–4 on a phone using mobile data, not Wi-Fi. Save screenshots to `specs/007-launch-ready/results/phone-qa/`. Check text is readable, buttons are tappable, and the booking slip can be saved or shared.

## When something fails
Do not fix it live. Roll back (`rollback.md`) if visitors are affected, then write down the failing line and the time.
