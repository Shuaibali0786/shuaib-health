# Research: Public Pages

**Feature**: 002-public-pages | **Date**: 2026-10-02

No `NEEDS CLARIFICATION` remains. Versions were read from the npm registry on 2026-10-02 (`npm view`, read-only; nothing installed). Next.js behaviour was checked against the docs shipped in `frontend/node_modules/next/dist/docs` (as `frontend/AGENTS.md` requires for this Next version).

## R1. Filtering on statically generated list pages

**Decision**: server-render the full list; a client island inside `<Suspense>` filters it using URL query parameters (`?department=`, `?q=`, `?day=`, `?category=`). The Suspense fallback is the same full, unfiltered server-rendered list.

**Rationale**: the Next docs state that a prerendered page calling `useSearchParams` in a Client Component must sit under a `Suspense` boundary or the build fails; with the boundary, everything above it is still prerendered. Using the full list as the fallback gives no-JavaScript users the whole catalog, avoids a blank loading flash, and keeps the layout stable (CLS). Keeping filters in the URL makes the "filters survive going back" requirement (FR-022) work with the browser's own history. Data sets are tiny (9 / 24 / 6 items), so filtering in the browser is instant (SC-007).

**Alternatives considered**
- Pure client state (`useState`): rejected; filters are lost on back navigation.
- Server-side filtering through `searchParams` in the page: rejected; makes every list page dynamic (request-time), which breaks static generation and the "build never depends on an API" posture, and adds latency per keystroke.
- Link-based filters only (`<a href="?department=cardiology">`): rejected for search (needs typing) but kept as the documented fallback if INP regresses.

## R2. Dynamic detail pages and unknown slugs

**Decision**: `generateStaticParams` from the data + `dynamicParams = false` on each `[slug]` route; the not-found page already exists. Verify in Phase A that unknown slugs return status 404 with the layout and notice (Feature 001 recorded a harmless `NoFallbackError` server log for this setting).

**Rationale**: the spec requires pages to be generated ahead of time and unknown slugs to show not-found. `dynamicParams = false` makes this a build-time guarantee with no runtime rendering.

**Alternatives considered**: default `dynamicParams` with `notFound()` when data is missing; equally correct for the visitor but allows on-demand rendering of arbitrary slugs. Kept as the fallback if the 404 page or log noise misbehaves on the new routes.

## R3. Removing the "Coming soon" catch-all

**Decision**: real routes win over `[...slug]` in the App Router, so each phase removes its own paths from the registry in `lib/routes.ts`; the final Phase D task deletes the catch-all, the registry and `isKnownPath`'s placeholder branch, and rebuilds `isKnownPath` from the page manifest. `/book-appointment` becomes a real page (reusing `ComingSoon`, copy "Booking coming soon"). `/home-sample-collection` is dropped.

**Rationale**: avoids dead links at any commit; the existing Feature 001 test that fails when a registered placeholder also has a real page enforces the cleanup.

**Alternatives considered**: delete the catch-all first (breaks every not-yet-built link on the branch); keep it permanently (dead code; two places that decide what a 404 is).

## R4. Single page manifest

**Decision**: `lib/pages.ts` exports `getPageManifest()` → `{ path, title, description, kind, lastModified? }[]`, built from `ROUTES` and the data arrays. Pages' `generateMetadata`, `sitemap.ts`, the unique-title test and the link crawler read it.

**Rationale**: one list is the least code to keep consistent and makes FR-005/FR-008/SC-003 mechanically testable. Titles are short (the layout template appends "| Shuaib Health"); descriptions 50–160 characters, written per page or derived per record (for example "Dr. Imran Qureshi, Cardiology — qualifications, languages, fee and weekly schedule (sample profile).").

**Alternatives considered**: metadata inline in each page (duplicates, cannot test uniqueness across pages without importing every page).

## R5. Sitemap, robots and canonical base URL

**Decision**: `app/sitemap.ts` (typed `MetadataRoute.Sitemap`) from the manifest; `app/robots.ts` returning `rules: { userAgent: "*", disallow: "/" }` while `siteConfig.indexable` is false, otherwise `allow: "/"` plus `sitemap`. Absolute URLs need a base: optional public env `SITE_URL`, default `http://localhost:3000`, documented in a new `frontend/.env.example`; the root layout sets `metadataBase` from it.

**Rationale**: both files are first-class Next metadata conventions and are statically generated. Keeping the sitemap correct while the site is `noindex` follows the spec (FR-008) and lets Phase 4 simply flip the flag and set `SITE_URL`. The env var is read with a default, so the build never needs it (Constitution V).

**Alternatives considered**: hard-code a production domain (does not exist yet; would be a fabricated URL); omit the sitemap while not indexable (spec asks for it).

## R6. Open Graph images

**Decision**: `app/opengraph-image.tsx` (site card: logo mark, name, tagline, demo notice) inherited by static pages, plus `opengraph-image.tsx` inside each detail family showing the record's title, generated at build with `ImageResponse` and the same approach as the existing `apple-icon.tsx`. No image files are added.

**Rationale**: the spec asks for an OG image on every page and the user asked to keep new image files minimal. Detail pages benefit from a title on the card; static pages already have a distinctive `og:title`.

**Alternatives considered**: a static JPG (needs a new asset; same card for every page); one dynamic route handler `/og?title=` (request-time rendering and an open endpoint that renders arbitrary text). **Risk**: `ImageResponse` needs a font for non-Latin text; only Latin text is used. If rendering fails on the build machine (as noted for the touch icon in Feature 001 R9), fall back to the site card for detail pages (non-blocking).

## R7. Map without an API key

**Decision**: `MapEmbed` client component. Initially renders a card with the text address, the "Map shows the general area; the address is a sample" note, and a "Show map" button. On press it renders `<iframe title="Map of the general Karachi area" src="https://www.openstreetmap.org/export/embed.html?bbox=66.95%2C24.78%2C67.20%2C24.96&layer=mapnik" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin">`, with no marker, plus a text link "Open this area in OpenStreetMap". Disclosure text before the press: "Showing the map contacts OpenStreetMap."

**Rationale**: OpenStreetMap's "export embed" URL needs no account or key and no marker, so no real business is pinned. The opt-in keeps page load free of third-party requests (FR-009, privacy) and keeps the build/E2E offline-safe. `sandbox` limits the frame; `no-referrer` avoids leaking the page URL.

**Alternatives considered**: Google Maps embed (key or consent banner, brand); static map image (needs an image and a tile service); text-only (spec asks for a map). **Follow-up for Phase 4**: when a CSP is added it must allow `frame-src https://www.openstreetmap.org`.

## R8. Contact form validation

**Decision**: `react-hook-form` ^7.89 + `zod` ^4.6 + `@hookform/resolvers` ^5.9 (peer ranges verified compatible). Schema in `lib/contactSchema.ts`: name 2–80 trimmed; contact (phone or email) with either value valid; subject 3–100; message 10–1,000; phone accepts `+92 300 0000000`, `0300-0000000`, `0213000000` shapes after stripping spaces/dashes/parentheses (digits only, 10–13). Errors show next to fields (`aria-invalid`, `aria-describedby`), an error summary with links, and focus moves to the summary on failed submit; values are kept. Success shows a `role="status"` message; the handler does nothing else (no `fetch`, no storage).

**Rationale**: the constitution names this stack and mandates Zod on the frontend (Principle IV); the same schema will validate the real endpoint later. The dependencies load only on `/contact`.

**Alternatives considered**: hand-written validation (less code now, but a second validation style later and weaker typing); native HTML validation only (browser-specific, unstyled messages, poor control of focus and summary, fails WCAG 3.3.1 consistency). Zustand not needed.

## R9. FAQ accordion

**Decision**: native `<details><summary>` per question inside `<section id="group-slug"><h2>…`. Styling with Tailwind; chevron via CSS rotated with `details[open]`; rotation transition is `motion-safe` only.

**Rationale**: built-in keyboard (Enter/Space), exposed expanded state, works without JavaScript, no ARIA to get wrong. Group anchors give `/faq#home-sample-collection`. Tests assert `open` toggling by keyboard.

**Alternatives considered**: WAI-ARIA disclosure buttons with `aria-expanded` (more code, needs JS); Radix accordion (new dependency).

## R10. Accessibility patterns for the new components

- **Breadcrumbs**: `<nav aria-label="Breadcrumb"><ol>`; last item is text with `aria-current="page"`; separators are CSS (not read).
- **Filters**: every control has a visible `<label>`; the search input is `type="search"` with `autocomplete="off"`; category chips are a labelled group of toggle buttons with `aria-pressed`; result count is a `role="status"` line (`aria-live="polite"`) so changes are announced; "Clear filters" is a real button.
- **Tables**: schedule and hours use `<caption>`, `<th scope="col|row">`; at 320 px they scroll inside a labelled container only if needed, otherwise stack by CSS (decide in implementation by testing; no horizontal page scroll).
- **Forms**: labels, required indicators in text, error text not colour-only, 24 px minimum targets, `autocomplete` hints (`name`, `tel`/`email`), summary receives focus.
- **Focus**: existing `scroll-padding-top` keeps focus clear of the sticky header (WCAG 2.2 focus not obscured); anchored FAQ and legal sections inherit it.
- **Images**: informative alt text on photos (existing pattern); icons `aria-hidden`; lab test category/package icons are decorative next to text.
- **Motion**: no new motion; `Reveal` reused; accordion chevron transition is `motion-safe`.
- **Headings**: one `h1` per page (from `PageHeader`), `h2` sections, `h3` card titles.

## R11. Next available day in Asia/Karachi

**Decision**: pure function `nextAvailable(schedule, now = new Date())` in `lib/schedule.ts` using `Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now)`. Returns `{ kind: "today", day, end }` if a session today has not ended, else `{ kind: "tomorrow" | "later", day }`. The client component calls it in an effect after mount; server HTML renders "Available Mon, Wed, Fri" (derived from the schedule, so never stale).

**Rationale**: the page is built once, so "today" must be evaluated in the browser; Karachi has no daylight saving, so day arithmetic is exact. The effect avoids hydration mismatches (Feature 001 formatters were designed for the same reason).

**Alternatives considered**: compute at build time (stale within a day); incremental regeneration (needs a server and a backend-like runtime); fixed copy only (spec requires a next available day).

## R12. Reading time

**Decision**: `readingMinutes = max(1, ceil(words / 200))` where `words` counts the text of all article blocks; computed in `lib/readingTime.ts`, not stored. 200 wpm is a common conservative adult average for non-technical text.

**Alternatives considered**: store minutes in data (can drift from the text); 238 wpm (less conservative).

## R13. Article and legal content representation

**Decision**: typed blocks (`{ type: "heading" | "paragraph" | "list", ... }`) rendered by `ArticleBody` and `LegalPage`; no markdown or MDX.

**Rationale**: zero new dependencies, no HTML injection risk (`dangerouslySetInnerHTML` is not needed and is banned by a guard test), trivial to test word counts and forbidden phrases. When a CMS/API arrives (Phase 2+) the same blocks can be returned as JSON.

**Alternatives considered**: MDX (new tooling and build config for 6 articles); raw HTML strings (XSS-shaped habit).

## R14. Icons for lab categories and packages

**Decision**: extend the `IconName` union and `ICONS` map (Feature 001 pattern: data stores names, `ui/icons.ts` maps to lucide components). Verified present in the installed `lucide-react` on 2026-10-02: `Droplet` (Blood), `Candy` (Diabetes), `HeartPulse` (Heart), `Flame` (Liver), `Bean` (Kidney), `Activity` (Thyroid), `Sun` (Vitamins), `Sparkles` (Hormones), `TestTube` (Urine), `ClipboardCheck` (Basic Health Check), `Candy`/`Droplets` (Diabetes Care), `HeartPulse` (Heart Check), `Flower2` (Women's Health), `Hourglass` (Senior Citizen). No brand icons.

**Rationale**: the spec prefers icons over photos for these (FR-049); no new files; consistent with Home.

## R15. Package pricing display

**Decision**: store only `testSlugs` and `packagePricePkr` (sample). `summarizePackage()` returns `{ tests, sumPkr, savingPkr }`. Display: "Sum of individual tests PKR X", "Package price PKR Y (sample)", "Difference PKR Z". No percentages, no "best value" or similar claims (FR-048).

**Rationale**: derived totals cannot drift from the catalog; one tested function; honest wording.

## R16. New dependencies check (Constitution "Technology Stack")

Only `react-hook-form`, `zod`, `@hookform/resolvers`: all named in the constitution stack, first needed now (a validated form). Nothing else is added; Zustand is still unused and stays uninstalled. Bundle impact is confined to `/contact` (App Router splits per route); measured from `next build` output in Phase E and recorded in `quickstart.md`.

## R17. Testing the Karachi clock and the network

**Decision**: unit tests inject `now`; Playwright uses `page.clock.setFixedTime` for the "next available" text and `context.route("**/*", ...)` to abort and count non-same-origin requests (the allowed OpenStreetMap frame is only requested after the button press, which one test does explicitly while asserting the opt-in text). A guard test greps `src` for `fetch(`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `document.cookie`, `dangerouslySetInnerHTML`.

## R18. Risks and open verification items

1. Re-verify the `dynamicParams = false` 404 behaviour on the first new detail route (R2).
2. `ImageResponse` rendering on the build machine (R6).
3. Table layout at 320 px (R10) — decided during implementation by an E2E overflow test.
4. Cyrillic text is visible on the cover of the book in the `dr-bilal-ansari.jpg` photo (a book titled in Russian about oncology, held by the dentist). It is not a brand, but it is unrelated text on a dental profile; the user may want to swap that photo. The alt text will not mention it. Likewise `dr-zainab-memon.jpg` shows a lab bench action shot rather than a head-and-shoulders portrait, and `dr-faisal-chaudhry.jpg` shows outstretched hands holding a tape measure; all faces are whole and framing is consistent enough for 4:5 cards.
