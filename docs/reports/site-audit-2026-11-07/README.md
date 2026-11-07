# Public-site audit, live site, 7 Nov 2026

Read-only, no logins. Target: `https://shuaib-health-web.vercel.app` (production as deployed on 7 Nov 2026, before this branch).
Pages: all 59 sitemap URLs + `/book-appointment`, `/demo/specialties` and its 4 presets = **65 pages**, each at mobile and desktop.

Tools: Lighthouse 12.6.1 (one run per page and form factor, default simulated throttling, headless Chrome on the
owner's laptop); an HTML crawl (fetch + jsdom) for titles, descriptions, canonicals, `h1`s, image alt text and every
link (113 unique). Data: `lighthouse-summary.json` (scores per page + failing audits), `crawl.json` (meta per page, broken links).

## Scores (65 pages)
| | Performance | Accessibility | Best Practices | SEO | LCP (worst) | TBT (worst) | CLS (worst) |
|---|---|---|---|---|---|---|---|
| **Mobile** | min 95, median 98 | min 98, median 100 | 100 everywhere | 66–69 (by design, see below) | 2.6 s (`/`) | 182 ms (`/doctors`) | 0.01 |
| **Desktop** | 100 everywhere | min 98, median 100 | 100 everywhere | 66–69 (by design) | 0.5 s | 9 ms | 0 |

Per-page table: `lighthouse-summary.json` → `rows`.

## Findings
| # | Finding | Pages | Severity | Action |
|---|---|---|---|---|
| F1 | SEO `is-crawlable` fails: `noindex, nofollow` + `robots.txt Disallow: /` | all | expected | None. The demo clinic stays noindex by design (`indexable` flag). 66 vs 69 is only Lighthouse weighting (no images on lab-test pages) |
| F2 | Accessibility `heading-order`: listing pages go `h1` → card `h3` with no `h2` | `/doctors`, `/departments`, `/lab-tests`, `/health-tips` | low (a11y 98) | **Fixed on branch**: a visually hidden `h2` per listing section; e2e test added |
| F3 | No `og:image` on 16 pages (all listing, legal, booking and preset pages): the page's own `openGraph` metadata replaces the site-wide card instead of inheriting it | listed in `crawl.json` | low (social shares show no picture) | **Fixed on branch**: section card per folder (`sectionCard()` in `src/lib/og.tsx`); unit + e2e tests added |
| F4 | `/book-appointment` meta description 58 characters (short) | 1 | very low | **Fixed on branch**: 120-character description |
| F5 | 4 lab-test titles 61–64 characters (may be cut in search results) | `/lab-tests/esr`, `hepatitis-b-surface-antigen`, `fsh`, `urine-routine-examination` | very low | Not changed: titles come from catalog data (database); noindex anyway |
| F6 | `robots.txt` advertises the sitemap while disallowing everything | — | info | Not changed: harmless, and flipping `indexable` makes it correct for a real clinic |
| F7 | External link to openstreetmap.org returned 429 to the crawler | `/contact` | none | Rate limit for bots; the link works in a browser |

No broken internal links (113 checked), no missing `alt` attributes, no duplicate titles or descriptions, every page
has exactly one `h1`, a canonical link and `lang="en"`.

## Not covered
- `/book-appointment/confirmed/[reference]` (needs a real booking, which would write to the production database).
- Staff pages (`/admin/*`; no logins by rule).
- Real-device testing; Lighthouse runs from one laptop and network.
