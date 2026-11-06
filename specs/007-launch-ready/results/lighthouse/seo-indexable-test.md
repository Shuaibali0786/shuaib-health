# SEO check with `indexable=true` (T112), 2026-11-06

**Test-only.** Nothing in the repo, the seed, the fixtures, the Neon databases or the live site was changed.

## How
- Production build (`next build`, separate dist dir `.next-t112`, since deleted) and `next start` on localhost:3411.
- Catalog data: the repo's own mock API (`tests/mock-api/server.mjs`, mode `ok`) behind a throwaway proxy that rewrites only `clinic.indexable` from `false` to `true` in the response. The proxy lived in the scratchpad and was not committed. All servers were stopped afterwards.
- Lighthouse 12.6.1, mobile, 3 runs per page.

## Result: PASS (SC-002)
| Page | SEO (3 runs) | Failing SEO audits |
|---|---|---|
| `/` | 100, 100, 100 | none |
| `/doctors` (catalog page) | 100, 100, 100 | none |

With `indexable=true` the pages carry `<meta name="robots" content="index, follow">`, `/robots.txt` allows `/` and disallows only `/admin`, and `/sitemap.xml` lists the site pages (all `http://localhost:3411` here, because `SITE_URL` was the local address; on the live site they use the live `https://` origin).

The live SEO score of 66 to 69 is therefore explained only by the "blocked from indexing" audit of the noindex demo (`lighthouse/live-2026-11-06.md`).

Performance, Accessibility and Best Practices from this local run are not evidence for the live site (local machine, mock data); use the live run for those.
