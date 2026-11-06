# Custom domain preparation

Preparation only. **No domain is bought** and nothing here is done until the owner decides. 🔑 = owner. Today the demo lives on `*.vercel.app` and is `noindex`.

## Settings that change
| Where | Setting | New value |
|---|---|---|
| Website project | `SITE_URL` | `https://<new domain>` (no trailing slash) |
| API project | `CORS_ORIGINS` | the website's new origin only; no `*`, no trailing slash |
| Website project | `CATALOG_API_URL` | unchanged unless the API also gets a domain |
| Vercel | Domains | add the domain to `shuaib-health-web`, follow the DNS instructions, wait for the certificate |
| Website | HSTS `preload` | **not now**. Preload is a one-way door; consider only after the domain has served HTTPS correctly for a long time |
| Clinic data | `indexable` | stays `false` for the demo clinic. A real client's clinic is switched by an explicit, reviewed change |

Order: add the domain in Vercel -> set `SITE_URL` and `CORS_ORIGINS` -> redeploy API then website (`new-env-var.md`).

## Checks to re-run on the new domain
- `smoke-test.md` in full, especially: canonical, `og:url`, `/sitemap.xml`, `/robots.txt` hold only the new `https://` origin, and nothing mentions `localhost`.
- Security headers on `/`, a catalog page, `/admin/login`.
- **Sign-in check (audit E1):** open `/admin/login` on the **new origin**, sign in as staff, load the dashboard, sign out. Cookies are origin-bound; the old `*.vercel.app` sessions do not carry over.
- Booking end to end, and the demo button.
- If the `.vercel.app` address stays reachable, decide whether to redirect it to the new domain.

## Not in scope
Buying the domain, email on the domain, and moving to a paid Vercel plan.
