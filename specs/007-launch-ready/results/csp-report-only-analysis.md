# CSP report-only analysis (T069), 2026-11-06

Read-only analysis of the live site, which sends `Content-Security-Policy-Report-Only` (`SITE_SECURITY_HEADERS=report`). Production was **not** changed.

## Recommendation: do NOT switch to `enforce` yet. Fix two things first, then enforce.

### How the live policy looks
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Applies to public pages only (staff pages keep their own `frame-ancestors 'none'`).

### What I could check
- Lighthouse `inspector-issues` on 9 live page loads (`/`, `/doctors`, `/book-appointment`, 3 runs each): **no CSP issue on `/` and `/doctors`; one CSP issue on `/book-appointment` in all 3 runs.** Console errors: none.
- Source search for outside hosts (`https://` in `frontend/src`).

### Finding 1: Zod `new Function("")` probe on `/book-appointment` (harmless)
Zod 4.6.7 checks eval support with `new Function("")` in a `try/catch` and falls back to a non-JIT path (`node_modules/zod/v4/core/util.js`, `allowsEval`). The throw is swallowed, so enforcing causes **no functional break**, but the browser logs a violation each visit. Zod skips the probe when `jitless` is set. Fix prepared: `z.config({ jitless: true })` in `lib/booking/form.ts` (PR #20).

### Finding 2 (blocker): the contact page map would be blocked by `enforce`
`components/contact/MapEmbed.tsx` shows an `<iframe src="https://www.openstreetmap.org/export/embed.html...">` after the visitor clicks "Show map". The policy has no `frame-src`, so it falls back to `default-src 'self'`: an enforced policy would block the frame (blank box). The click-only iframe never loaded in my automated runs, so report-only has not recorded it. Fix prepared: `frame-src https://www.openstreetmap.org` (PR #20).

### Not covered / caveats
- I did not click "Show map", did not run the booking flow, and did not visit `/contact`, the confirmation slip or the demo pages in a real browser with the console open. The owner (or a Playwright run) should do that on the preview of PR #20 before enforcing.
- The policy has **no `report-uri` / `report-to`**, so violations are only visible in a browser console, **not in Sentry**. The status note's "check Sentry for CSP reports" will find nothing; that is not evidence of a clean release.
- Sentry could not be read from the agent session.

### Plan (nothing merged or changed)
1. 🔑 Review PR #20 (draft, **not merged**). It also has one failing unit test: `guards.test.ts` ("keeps the OpenStreetMap URL inside MapEmbed.tsx") now sees the host in `lib/security-headers.ts`. I did not loosen it; an owner-approved one-line amendment is needed (allow `lib/security-headers.ts`).
2. After approval and merge, on the new release in `report` mode: open `/contact`, click "Show map", walk through booking and the slip, with the browser console open. Zero CSP lines expected.
3. Then 🔑 set `SITE_SECURITY_HEADERS=enforce` (website, Production) and redeploy, and Claude reruns `frontend/tests/e2e/security-headers.spec.ts` on the live URL.
