# CSP report-only analysis (T069), 2026-11-06

Read-only analysis of the live site, which sends `Content-Security-Policy-Report-Only` (`SITE_SECURITY_HEADERS=report`). Production was **not** changed.

## Recommendation: do NOT switch to `enforce` yet. The two fixes are now live; collect reports for one clean release, then enforce.

**Update (6 Nov 2026, evening):** PR #20 is **merged** (OpenStreetMap `frame-src`, Zod `jitless`, guard amended with owner approval to allow only that one entry). A `report-uri` was added: the policy now sends violation reports to the website's Sentry security endpoint, read from the env var `CSP_REPORT_URI` (set by the owner as a Sensitive Production variable). The website was redeployed from `main` (1a71710, no build cache) and the live header carries a `report-uri` (value not recorded here). The policy is still **report-only**.

### How the live policy looks
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Applies to public pages only (staff pages keep their own `frame-ancestors 'none'`).

### What I could check
- Lighthouse `inspector-issues` on 9 live page loads (`/`, `/doctors`, `/book-appointment`, 3 runs each): **no CSP issue on `/` and `/doctors`; one CSP issue on `/book-appointment` in all 3 runs.** Console errors: none.
- Source search for outside hosts (`https://` in `frontend/src`).

### Finding 1: Zod `new Function("")` probe on `/book-appointment` (harmless)
Zod 4.6.7 checks eval support with `new Function("")` in a `try/catch` and falls back to a non-JIT path (`node_modules/zod/v4/core/util.js`, `allowsEval`). The throw is swallowed, so enforcing causes **no functional break**, but the browser logs a violation each visit. Zod skips the probe when `jitless` is set. Fixed: `z.config({ jitless: true })` in `lib/booking/form.ts` (PR #20, merged).

### Finding 2 (blocker): the contact page map would be blocked by `enforce`
`components/contact/MapEmbed.tsx` shows an `<iframe src="https://www.openstreetmap.org/export/embed.html...">` after the visitor clicks "Show map". The policy has no `frame-src`, so it falls back to `default-src 'self'`: an enforced policy would block the frame (blank box). The click-only iframe never loaded in my automated runs, so report-only has not recorded it. Fixed: `frame-src https://www.openstreetmap.org` (PR #20, merged); the live header now has it.

### Not covered / caveats
- I did not click "Show map", did not run the booking flow, and did not visit `/contact`, the confirmation slip or the demo pages in a real browser with the console open. The owner (or a Playwright run) should do that on the preview of PR #20 before enforcing.
- ~~The policy has no report endpoint~~ Fixed: reports now go to Sentry through `report-uri` (see the update above). Reports from before the redeploy do not exist, so a clean Sentry only counts from the redeploy onward.
- Sentry could not be read from the agent session.

### Plan
1. ~~Review and merge PR #20~~ Done.
2. Over the next release window, with the report-only policy live: 🔑 open `/contact`, click "Show map", walk through booking and the slip with the browser console open. Zero CSP lines expected. Then 🔑 look at Sentry -> `shuaib-health-web` -> Security Headers / Issues for CSP reports.
3. If there are none, 🔑 set `SITE_SECURITY_HEADERS=enforce` (website, Production) and redeploy; Claude reruns `frontend/tests/e2e/security-headers.spec.ts` on the live URL. T069 stays open until then.
