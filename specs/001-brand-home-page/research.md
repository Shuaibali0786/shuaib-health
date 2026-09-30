# Research: Shuaib Health Brand, Site Layout and Home Page

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

All items from the plan's Technical Context are resolved; no `NEEDS CLARIFICATION` remains. Version numbers were read from the npm registry on 2026-09-30 (read-only `npm view`, nothing installed). Library behaviour was checked against Next.js and Tailwind documentation (Context7).

## R1. Package versions and pins

**Decision** — install these (exact ranges chosen at scaffold time, lockfile committed):

| Package | Version | Notes |
|---------|---------|-------|
| next | 16.3.7 | App Router; `eslint-config-next` 16.3.7 |
| react / react-dom | 19.3.0 | `@types/react` and `@types/react-dom` 19.3.0 |
| typescript | **~6.0.3** | **Pinned below latest (7.0.2)** |
| tailwindcss + @tailwindcss/postcss | 4.3.3 | CSS-first, no `tailwind.config` |
| framer-motion | 13.4.6 | Constitution names "Framer Motion"; same code base as `motion` |
| lucide-react | 1.49.0 | Do not use brand icons (removed in 1.x); none are needed |
| eslint | **^9.39.5** | **Pinned below latest (10.11.0)** |
| eslint-config-next | 16.3.7 | Brings typescript-eslint ^8.46, react, react-hooks, jsx-a11y, import plugins |
| vitest | 5.0.2 | Requires Node ^22.12 or ^24 (OK on Node 24) |
| vite | ^8.3.1 | Explicit dev dependency: `@vitejs/plugin-react` 6.1.1 needs vite ^8 |
| @vitejs/plugin-react | 6.1.1 | |
| jsdom | 30.1.1 | |
| @testing-library/react | 16.3.3 | with `@testing-library/dom`, `@testing-library/jest-dom` 7.0.1, `@testing-library/user-event` 14.6.7 |
| @playwright/test | 1.63.0 | Chromium only (`npx playwright install chromium`) |
| @axe-core/playwright | 4.13.0 | WCAG 2.2 AA scans |
| vite-tsconfig-paths | 6.1.1 | Lets Vitest resolve the `@/*` alias |
| @types/node | ^24.19.0 | Matches Node 24 |

**Rationale**
- `npm view typescript` reports `latest` = 7.0.2, but `typescript-eslint` 8.71.0 (used by `eslint-config-next`) declares support for `typescript >=4.8.4 <6.1.0`. Running TypeScript 7 would put the linter on an unsupported combination. TypeScript 6.0.3 is the newest supported release.
- `npm view eslint` reports `latest` = 10.11.0, but `eslint-plugin-react` (peer up to `^9.7`), `eslint-plugin-jsx-a11y` (up to `^9`) and `eslint-plugin-import` (up to `^9`) do not list ESLint 10. ESLint 9.39.5 is the newest line all of them support.
- Next 16 removed the `next lint` command; the `lint` script is `eslint .` with a flat config (`eslint.config.mjs`).
- Node 24 is set through `engines.node = "24.x"`, which Vercel honors, so the local and deployed runtime match.

**Alternatives considered**
- Use `latest` for everything: rejected (unsupported lint stack, see above).
- Drop `eslint-config-next` and hand-pick plugins: rejected; more maintenance for no benefit.
- Jest instead of Vitest: rejected; Vitest is faster with TypeScript and ESM, and the user chose it.

**Risks / verification at scaffold time**: `create-next-app` will probably install TypeScript 7 and ESLint 10 by default. After scaffolding run `npm install -D typescript@~6.0.3 eslint@^9.39.5`, then `npm ls typescript eslint` and confirm a clean `npm run lint`, `npm run typecheck`, `npm run build`. Also review whatever extra files the scaffolder writes (for example an `AGENTS.md` or `CLAUDE.md` inside `frontend/`) and remove any that duplicate root guidance. Re-run `npx create-next-app@16.3.7 --help` first to confirm flag names.

## R2. Framer Motion package and bundle size

**Decision**: install `framer-motion` and use `LazyMotion` with `domAnimation` and the `m` component; import `MotionConfig` with `reducedMotion="user"`.

**Rationale**: the constitution names Framer Motion. `framer-motion` and `motion` publish identical versions (13.4.6) and `framer-motion` is not deprecated, so the literal choice costs nothing; moving to `motion/react` later is an import change. `LazyMotion` avoids shipping the full feature set for simple fades and slides.

**Alternatives considered**: CSS-only scroll animations (smaller, but the user asked for Framer Motion and the reduced-motion logic is easier to test in one place); `motion` package (equivalent; rejected only to match the constitution wording).

## R3. Reduced motion and no-JavaScript safety

**Decision**: two layers.
1. Framer: `MotionConfig reducedMotion="user"` disables transform and layout animations for users who prefer reduced motion (opacity changes remain).
2. CSS: `@media (prefers-reduced-motion: reduce)` sets `transition-duration`/`animation-duration` to near zero and removes hover transforms.

`Reveal` renders children visible on the server. After hydration it applies the hidden state only to elements that are below the fold at that moment, then animates them in once as they scroll into view. The hero never uses hidden-then-reveal.

**Rationale**: SC-007 says nothing moves or scales under reduced motion, while the spec's edge case requires content to render when JavaScript is slow or unavailable. Hiding content on the server (`initial={{opacity:0}}`) would violate the second and delay LCP.

**Alternatives considered**: `initial="hidden"` server-side (rejected: blank page without JS, LCP risk); IntersectionObserver + CSS classes (viable, but reimplements what Framer provides).

## R4. Brand teal contrast (accessibility finding)

WCAG contrast ratios were computed for the planned pairs:

| Pair | Ratio | Verdict |
|------|-------|---------|
| navy #0B2545 on white | 15.39 | Pass |
| navy on surface #F5F9FC | 14.54 | Pass |
| **teal-500 #14B8A6 on white** | **2.49** | **Fails AA text and 3:1 non-text** |
| **white on teal-500** | **2.49** | **Fails** |
| navy on teal-500 | 6.18 | Pass |
| teal-500 on navy | 6.18 | Pass |
| teal-700 #0F766E on white | 5.47 | Pass |
| teal-700 on teal-50 #F0FDFA | 5.25 | Pass |
| teal-700 on surface | 5.17 | Pass |
| grey #5B6B7F on white | 5.45 | Pass |
| grey on surface | 5.15 | Pass |
| grey on teal-50 | 5.22 | Pass |
| white on blue-600 #2563EB | 5.17 | Pass |
| white on blue-700 #1D4ED8 | 6.70 | Pass |
| white on teal-700 | 5.47 | Pass |
| white on danger-700 #B42318 | 6.57 | Pass |
| teal-300 #5EEAD4 on navy | 10.40 | Pass |
| border-strong #7A8BA0 on white | 3.48 | Pass (UI boundary ≥ 3:1) |

**Decision** (encoded in [design-system.md](./design-system.md)):
- Brand teal `#14B8A6` is a **decorative and background** color: gradients, icon tiles, highlights, and buttons that carry **navy** text. It is never used as text or as the only cue for an icon on a light background.
- Teal **text and links** on light backgrounds use `teal-700`.
- On navy backgrounds, teal text uses `teal-300` or `teal-500` (both ≥ 6:1).
- Primary solid button: navy background, white text. Accent button: teal→sky light gradient with navy text. CTA band: navy→blue-800 gradient with white text.
- The "Health" wordmark uses `teal-600` (#0D9488). A logotype is exempt from text contrast rules, but this darker step is still visually the brand teal and reads better on white. The unit test checks it stays at or above 3:1 as large bold text.
- Grey text `#5B6B7F` is allowed on white, surface and teal-50 only, never on gradients or photos.
- Focus ring: `blue-700` on light backgrounds, `teal-300` on navy, 2 px with 2 px offset.

**Rationale**: the user specified the colors, and the constitution requires WCAG 2.2 AA. Role-based tokens satisfy both without changing the brand's look.

**Alternatives considered**: darken the brand teal everywhere (loses the requested #14B8A6 identity); white text on teal buttons (fails AA).

## R5. Tailwind v4 tokens and `next/font`

**Decision**: `globals.css` starts with `@import "tailwindcss";`, then an `@theme` block for colors (`--color-*`), radii (`--radius-*`), shadows (`--shadow-*`), easing, and a `@theme inline` block mapping `--font-heading` and `--font-sans` to the CSS variables created by `next/font`. Gradients are defined once as `@utility` classes. Both fonts load with `subsets: ["latin"]`, `display: "swap"`, and `variable` names applied to the `<html>` element. PostCSS uses `@tailwindcss/postcss`.

**Rationale**: verified against the Tailwind and Next.js docs: `@theme` namespaces (`--color-*`, `--radius-*`, `--shadow-*`, `--font-*`) generate matching utilities, and `next/font` variables must be mapped with `@theme inline` so the utility resolves the runtime variable. Shadows use `color-mix` with the navy token so no other literal color exists.

**Alternatives considered**: `tailwind.config.ts` (v3 style, not CSS-first); CSS custom properties outside `@theme` (no generated utilities).

## R6. Placeholder routes: one catch-all with a registry

**Decision**: `src/app/[...slug]/page.tsx` renders `ComingSoon` for paths present in a registry (`src/lib/routes.ts`), with `generateStaticParams` producing the list (fixed paths plus `/doctors/<slug>`, `/departments/<slug>`, `/health-tips/<slug>` from the mock data) and `export const dynamicParams = false` so anything unregistered returns the real 404. In Next 16 `params` is a Promise and must be awaited.

**Rationale**: fifteen or more near-identical page files would drift; a single registry is also the list the link-integrity test uses. Real pages later win automatically because Next prefers specific routes over catch-alls. Placeholders return HTTP 200 with `noindex`, while unknown URLs return 404 with the friendly page (spec edge case).

**Alternatives considered**: one folder per route (rejected: duplication); a rewrite to a single `/coming-soon` page (rejected: URL and active-nav state would be lost); a middleware/proxy redirect (rejected: needless runtime code).

## R7. Content layer and future API shapes

**Decision**: types in `src/types/content.ts`; sample data in `src/data/*.ts`; components call only async accessors in `src/lib/content.ts` (`getDepartments`, `getFeaturedDoctors`, `getLatestHealthTips`, `getSiteConfig`, slug lookups). Shapes use camelCase, string ids, kebab-case slugs, ISO 8601 timestamps with the `+05:00` offset, integer PKR amounts, and `isSample` on every record.

**Rationale**: async accessors mean Phase 2 changes one file (add `fetch` with a caught fallback to the same arrays, per Constitution V) and no components. Server components can `await` them directly.

**Alternatives considered**: import arrays directly in components (rejected: replacing the source would touch every component); a client store (rejected: static content needs no state, and Zustand is not needed yet).

## R8. Formatting: hydration-safe PKR and Karachi time

**Decision**: `formatPkr(n)` returns `"PKR " + n.toLocaleString("en-US")` for integers (for example `PKR 2,500`). Dates use `Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" })`. Opening hours are stored as rules (`days`, `opens`, `closes`, `timeZone`) and rendered by `formatOpeningHours`, always suffixed "PKT" (Karachi time).

**Rationale**: the `en-PK` currency style may render "Rs" and differs across ICU builds, which risks server/client hydration mismatches and would not match the spec example "PKR 2,500". An explicit time zone prevents visitor-locale drift (spec edge case).

**Alternatives considered**: `Intl.NumberFormat` currency style (ICU-dependent output); storing display strings (not API-shaped).

## R9. Logo and icons

**Decision**: `LogoMark` and `Logo` are inline SVG React components sharing path constants from `logo-paths.ts`. Gradient definitions use `useId()` so the header and footer logos never share duplicate `id`s. Gradient stops reference CSS variables (`var(--color-teal-500)`, `var(--color-navy-900)`) so the logo contains no hex values. `app/icon.svg` is a static file using the same paths; a unit test asserts the path data matches `logo-paths.ts` (drift guard). `apple-icon.tsx` (ImageResponse, 180×180) is attempted; if it cannot render the mark faithfully, it is omitted and the plan continues with `icon.svg` only (low impact).

The mark: a rounded-square plus sign (teal-500 → navy-900 diagonal gradient) with a white heartbeat polyline crossing its center whose peaks trace an "S". The exact geometry is drawn at implementation time and reviewed visually at 16, 32 and 64 px.

**Rationale**: inline SVG scales cleanly, needs no image request, and lets the wordmark use the font tokens. It is fully original and contains no third-party marks (Constitution I).

**Alternatives considered**: PNG/WebP logo (blurry, extra request); SVG file via `next/image` (needs `dangerouslyAllowSVG`, unnecessary here).

## R10. Placeholder images

**Decision**: generate JPG placeholders with `scripts/generate-placeholder-images.mjs` using `sharp` (installed by Next as its image optimizer; declared explicitly as a dev dependency if the script needs it). Each placeholder is a soft teal/navy gradient labelled "PLACEHOLDER" plus its own file name, at the size listed in [image-manifest.md](./image-manifest.md). Real photos replace files at the same path; dimensions in data stay accurate as long as the aspect ratio matches. Every image is rendered by `next/image` with explicit `width`, `height`, `sizes` and alt text from data.

**Rationale**: raster placeholders exercise the real optimization pipeline (AVIF/WebP, lazy loading, layout reservation) that real photos will use, unlike SVGs. Labels make them impossible to mistake for real photos. File names never include third-party names.

**Alternatives considered**: hotlinked stock images (rejected: third-party dependency, licensing, network); SVG placeholders (rejected: bypass optimization); empty gray boxes (rejected: do not test the image path).

## R11. Testing approach

**Decision**:
- Vitest with jsdom, `@vitejs/plugin-react`, `vite-tsconfig-paths`, and a `matchMedia` stub in `vitest.setup.ts`. Tests import components and data directly. Async server components are not rendered in Vitest; their output is covered by Playwright.
- Repo-guard tests read files with Node `fs` (no network): hex-literal ban, raw `<img>` ban, `fetch(`/backend env ban, honesty words, image files exist, token contrast, placeholder registry vs real pages.
- Playwright runs against the production build (`next build` then `next start` on port 3100), projects `mobile` (Pixel 7) and `desktop` (Desktop Chrome 1280×800). `reuseExistingServer` is on outside CI.
- Lighthouse: manual run for SC-008 now; CI budgets in Phase 4.

**Rationale**: E2E on a production build tests what ships (static HTML, real hydration). Guard tests turn constitution rules (I, V, VIII) into automatic failures.

**Alternatives considered**: Storybook/visual regression (out of scope now); Cypress (user chose Playwright).

## R12. Windows CMD and cross-platform scripts

**Decision**: every documented command uses CMD-valid syntax (`cd`, `copy`, `rmdir /s /q`, `set NAME=value`, `&&`, quoted paths). npm scripts contain no shell-specific syntax (no `export`, `rm`, `cp`, `$VAR`, or `NODE_ENV=` prefixes), so they behave identically in CMD, PowerShell and CI. Playwright's `webServer.command` is `npm run build && npm run start -- --port 3100`, valid in CMD.

**Rationale**: explicit user requirement.

## R13. Indexing and demo safety

**Decision**: root metadata sets `robots: { index: false, follow: false }`, driven by `siteConfig.indexable = false`. Placeholder pages also carry `noindex`.

**Rationale**: a fictional clinic with a Karachi address and phone should not be presented by search engines as a real provider (Constitution I intent). The flag makes a later decision trivial. This is a default, not a blocker: change `indexable` if you want the portfolio discoverable.

**Alternatives considered**: indexable by default (risk of misleading search results); relying only on the on-page notice (does not appear in search snippets).

## R14. Sample contact details

**Decision**: emergency phone `+92 21 0000 0000` (`tel:+922100000000`), general phone `+92 21 0000 0001`, address "Sample Road, Karachi, Pakistan", email `hello@example.com` is NOT shown (no email required by the spec). National numbers do not begin with 0 after the country code, so these cannot connect to a real subscriber. All are labelled sample.

**Rationale**: the emergency card must be a working `tel:` link for the interaction, but must never dial a real number. Avoids real neighborhoods that could match a real clinic.

## R15. Sample people and names

**Decision**: four invented sample doctors (for example Dr. Ayesha Rahman, Gynecology; Dr. Imran Qureshi, Cardiology; Dr. Sana Farooqui, Pediatrics; Dr. Hassan Mirza, General Medicine), each with a visible "Sample" badge, no credentials, ratings or experience claims, and fees between PKR 2,000 and PKR 3,500. Names are ordinary and may coincide with real people, which is why the badge and the site-wide notice are mandatory.

## R16. Items intentionally deferred

- Security headers / CSP, `robots.txt`/sitemap, Open Graph images: Phase 4.
- Lighthouse CI budgets: Phase 4 (manual check now).
- Zustand, React Hook Form, Zod: first needed by the booking flow.
- Analytics, cookie banner: out of scope (no cookies are set).
