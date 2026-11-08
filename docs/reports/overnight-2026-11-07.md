# Overnight report, 7 Nov 2026

Branch: `chore/overnight-2026-11-07` (3 commits on top of `main` at `c54aa0e`). **Not pushed, no PR** (see A1).
Nothing merged, nothing deployed, no Neon database touched, no secrets printed or saved.

## What was done
| # | Task | Result | Where |
|---|---|---|---|
| 1 | Image licence audit | 24 photos, 3 font families, 1 icon set, logo/OG art, OSM map listed with source and licence. Fonts (OFL), icons (ISC), map (ODbL) and own art are clear. **Photos: no per-photo Pexels links were ever recorded**, so none can be fully proven; 1 looks like it is not from Pexels at all (A2) | `CREDITS.md` |
| 2 | Backups prep (T083–T087) | Runbook now covers both layers: Neon instant restore (Free plan: 6 h window, checked in Neon docs today) and the daily encrypted `pg_dump`; monthly restore drill checklist. New owner-run scripts, **not run**: `restore-drill.ps1` (decrypt → restore into a `restore-drill-YYYYMMDD` scratch branch only, read-only counts, always deletes the decrypted file) and `drill-counts.sql` (read-only counts). Restore drill moved from quarterly to monthly | `docs/runbooks/backup-setup.md`, `restore-drill.md`, `scripts/backups/` |
| 3 | Live public-site audit | 65 pages × mobile + desktop. Mobile Performance 95–99, desktop 100; Accessibility 98–100; Best Practices 100; SEO 66–69 only because of the intended `noindex`. 113 links, 0 broken; 0 missing alt; titles/descriptions unique. **3 small fixes on the branch with tests**: social card (`og:image`) on 16 listing/legal/booking/preset pages; heading order on 4 listing pages; longer `/book-appointment` description | `docs/reports/site-audit-2026-11-07/` |
| 4 | Fiverr portfolio pack | 34 full-page screenshots (13 public pages live, desktop + mobile; 4 Demo Dashboard views from the existing sample-data captures), case study, feature list, 5 gig keywords + title. Checked: sample data, masked phones, no staff emails, no secrets | `docs/portfolio/` |
| 5 | AI voice agent plan | Will / will not, English-Urdu-Arabic, public data only, booking lookup with reference + last 4 digits, escalation rules, 36 red-team prompts, 3 providers with rough monthly cost | `docs/voice-agent/roles-draft.md` |

## Tests run
- Frontend unit (Vitest): **1,604 / 1,604 passed** (includes the new `tests/unit/og-sections.test.ts`, 18 cases).
- `npm run typecheck`: pass. ESLint on changed files: pass. gitleaks on staged changes: no leaks.
- `restore-drill.ps1`: PowerShell syntax check only (0 errors); deliberately not executed.
- **Not run locally:** the e2e specs I changed (`seo.spec.ts`, `a11y.spec.ts`) and `no-localhost.spec.ts`. The run was stopped by Claude Code because the laptop ran low on memory (not a test failure); I did not restart it. GitHub CI runs them once the branch is pushed.
- Backend: no backend files changed, so no backend suites were needed.

## Needs your approval
- **A1. Pushing the branch / draft PR.** Every push to this repo deploys a Vercel preview of `shuaib-health-api`, even for frontend-only changes (checked on PR #35), and that build runs `alembic upgrade head` against the **preview Neon database** (`backend/scripts/vercel_build.py`). With no new migration it is a no-op, but it still connects and queries Neon, which tonight's rules forbid. So I committed locally and stopped. To publish, either:
  (a) approve it as usual: `git push -u origin chore/overnight-2026-11-07` then `gh pr create --draft`; or
  (b) first add a Vercel "Ignored Build Step" for preview builds that do not touch `backend/` (then CI runs and the API preview is skipped).
- **A2. Photo `dr-bilal-ansari.jpg`**: the original is a 675×537 PNG with black borders and no metadata, so it looks like a screenshot, not a Pexels download. Replace it or find its source before using it in Fiverr material.
- **A3. Photo `general-medicine.jpg`**: its metadata says "Use with the permission of the artist" (Ana Karotkaya Photography). Confirm it came from Pexels (then the Pexels licence applies) or replace it.
- **A4. The other 22 photos**: add each Pexels page link to `CREDITS.md` (about 30 minutes; reverse image search works).
- **A5. Voice agent decisions** (section 12 of the draft): the will/won't lists, a new lookup endpoint (API contract change, own spec), and billing. All three providers cost money beyond trial credit, which conflicts with the free-tiers-only rule. My recommendation: free web-only Phase 0 first.
- **A6. Backups T083–T087** are still owner actions (age key, private repo, first run, drill, Drive copy). The runbook and scripts are ready.

## Follow-up, 8 Nov 2026 (owner approved A1–A4)
- A1: branch pushed, PR #37 opened. The API preview build ran against the preview database (nothing new to migrate).
- A2/A3: `dr-bilal-ansari.jpg` and `general-medicine.jpg` replaced with Pexels photos (Tran Nhu Tuan; RDNE Stock project), fitted with `npm run images -- fit`. Dr. Bilal's alt text was updated in the seed data and fixtures; the live database keeps the old alt text until an approved re-seed.
- A4: all 22 other photos traced to their exact Pexels pages (same pixel size plus an image comparison); links are in `CREDITS.md`. None needed replacing.
- The first CI run caught one test that relied on the old `aria-label="Departments"`; its selector now follows the new heading.

## Risks and notes
- The e2e changes (OG images on listing pages, the heading-order test) are only checked by unit tests and typecheck so far. First CI run after the push is the real check. If an OG route fails at build, the fallback is to delete the new `opengraph-image.tsx` files (no other code depends on them).
- Audit traffic: Lighthouse and the crawl made about 250 read-only page views on the live site; these pages read the catalog through the API like any visitor. No writes, no logins.
- The portfolio screenshots add 18 MB to the repo (JPEG, quality 85). If that is too much, keep them in Google Drive instead and drop `docs/portfolio/screenshots/` before merging.
- Untracked `.playwright-mcp/` (from an earlier session) was left alone.
