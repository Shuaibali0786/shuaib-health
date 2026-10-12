# Production smoke test, 2026-10-12

Website: https://shuaib-health-web.vercel.app · API: https://shuaib-health-api.vercel.app (both Vercel Hobby, `sin1`).
No personal data below. One demo booking was made with a made-up name and phone number (shown masked, labelled "Demo booking").

| # | Check | Desktop | Mobile (Pixel 7) |
|---|---|---|---|
| 1 | Home loads, no "temporarily unavailable", no `localhost` | PASS | PASS |
| 2 | Doctors list (9 links) and lab tests list with sample prices | PASS | PASS |
| 3 | Booking end to end: reference, masked slip, no personal data in the URL | PASS | PASS |
| 5 | `/admin/login` shows the form; `no-store`, `X-Robots-Tag: noindex`, own `frame-ancestors 'none'` CSP | PASS | PASS |
| 6 | `/robots.txt` disallows all; pages carry `noindex, nofollow` (clinic `indexable = false`, read through `/api/v1/clinic`) | PASS | - |
| 7 | No `localhost` in the home page or `/sitemap.xml` | PASS | - |
| 9 | HSTS, nosniff, X-Frame-Options, Permissions-Policy on `/`, `/doctors`, `/admin/login`; CSP report-only | PASS | - |
| 10 | API `/health` = `{"status":"ok"}` | PASS | - |
| 11 | API `/ready` = 200 | PASS | - |
| CORS | allowed for the website origin only | PASS | - |
| 4 | Demo dashboard | not run (creates a demo session; owner to run on phone) | - |

## Finding: one CSP report on `/book-appointment`
In report-only mode the console shows "Evaluating a string as JavaScript violates ... 'unsafe-eval'". It comes from Zod's feature probe `try { Function("") }` in a booking chunk. It is harmless (the probe catches the error and falls back), but it will appear as a blocked call under `enforce`. Before T069, either accept it or set Zod `jitless`. No change made now.

## TRUSTED_PROXY_HOPS = 1
`xffHops` in the runtime log was 1 for every request (direct calls and the website's server calls). A call sent with a forged two-address `X-Forwarded-For` was still logged as 1, so Vercel overwrites the header. Set `TRUSTED_PROXY_HOPS=1` in the API's Production environment and redeployed.
