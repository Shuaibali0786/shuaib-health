# Production smoke test, 7 Nov 2026 (after merging PR #24)

- Merge: PR #24 (specialty presets), merge commit `d22de93`.
- Deploys: web `shuaib-health-8vs6xuo1l` READY, api `shuaib-health-fogyuwr37` READY.
- Previous production deploys (rollback targets): web `shuaib-health-7h07zwm0r`, api `shuaib-health-bv6jpn76c`.
- Read-only checks with curl. No booking was created.

| Check | Before merge | After merge |
|---|---|---|
| Home `/` (200, "Portfolio demo", no localhost) | PASS | PASS |
| `/doctors` (real data, no "temporarily unavailable") | PASS | PASS |
| `/lab-tests` | PASS | PASS |
| `/book-appointment` | PASS | PASS |
| `/admin/login` (200, noindex) | PASS | PASS |
| API `/health` (200 `{"status":"ok"}`) | PASS | PASS |
| `/demo/specialties` and the 4 preset pages (200) | 404 (not deployed yet) | PASS ×5 |
| Preset pages carry `noindex, nofollow` | n/a | PASS |
| Assistant launcher not in the HTML (flag off) | PASS | PASS |
| Vercel production error logs, 20 minutes after the deploy (web and api) | n/a | none |
| Sentry | not checked (no Sentry access from the agent) | not checked |

Result: PASS. No rollback needed.
