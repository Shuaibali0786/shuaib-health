# Design System: Shuaib Health (Feature 001)

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

Premium, calm, light. Tokens are defined once in `frontend/src/app/globals.css` under `@theme`; components only use the generated utilities. The contrast values below were computed with the WCAG 2.x relative-luminance formula; `tests/unit/tokens.test.ts` recomputes them from the CSS file on every run.

## 1. Color tokens

| Token | Value | Role |
|-------|-------|------|
| `navy-900` | `#0B2545` | Headings, primary button background, footer/CTA base |
| `navy-800` | `#123A6B` | Hover for navy, gradient end on dark surfaces |
| `teal-50` | `#F0FDFA` | Soft tinted section background |
| `teal-100` | `#CCFBF1` | Icon tile background |
| `teal-300` | `#5EEAD4` | Teal text and icons on navy |
| `teal-400` | `#2DD4BF` | Light accent-gradient start |
| `teal-500` | `#14B8A6` | Brand accent: gradients, highlights, backgrounds under navy text |
| `teal-600` | `#0D9488` | Wordmark "Health" |
| `teal-700` | `#0F766E` | Teal text and links on light backgrounds |
| `sky-400` | `#38BDF8` | Light accent-gradient end |
| `blue-600` | `#2563EB` | Blue accent (gradient end for decoration) |
| `blue-700` | `#1D4ED8` | Focus ring on light backgrounds, link hover |
| `blue-50` | `#EFF6FF` | Soft blue tint |
| `ink` | `#22344F` | Body text (default) |
| `muted` | `#5B6B7F` | Secondary text (supplied by the brief) |
| `background` | `#FFFFFF` | Page |
| `surface` | `#F5F9FC` | Alternate section band |
| `border` | `#DCE6EE` | Decorative dividers (not a required boundary) |
| `border-strong` | `#7A8BA0` | Boundaries that identify a control (≥ 3:1) |
| `danger-700` | `#B42318` | Emergency emphasis (text/icon on light, background under white text) |
| `danger-50` | `#FEF3F2` | Emergency card background |

Exact hex strings appear only in `globals.css` (and the static `icon.svg`). Gradient stops and shadows reference these tokens.

### Approved combinations (text and UI contrast)

| Foreground on background | Ratio | Use |
|--------------------------|-------|-----|
| navy-900 on background / surface | 15.39 / 14.54 | Headings, primary text |
| ink on background | ≥ 11 (checked by test) | Body |
| muted on background / surface / teal-50 | 5.45 / 5.15 / 5.22 | Secondary text (never on gradients or photos) |
| teal-700 on background / teal-50 / surface | 5.47 / 5.25 / 5.17 | Links, eyebrow labels |
| navy-900 on teal-500 | 6.18 | Accent buttons, badges |
| white on navy-900 | 15.39 | Primary button, CTA band |
| white on blue-700 | 6.70 | Blue solid elements |
| white on danger-700 | 6.57 | Emergency button |
| danger-700 on background | 6.57 | Emergency text |
| teal-300 on navy-900 | 10.40 | Accent text on dark |
| teal-500 on navy-900 | 6.18 | Icons on dark |
| border-strong on background | 3.48 | Control outlines |

Forbidden: white or muted text on teal-500; teal-500 or teal-400 as text or as a sole icon color on light backgrounds (2.49:1); any text on the decorative `bg-brand-gradient` (teal-500 → blue-600).

### Gradients (`@utility`, defined once)

| Utility | Stops | Text allowed |
|---------|-------|--------------|
| `bg-brand-gradient` | teal-500 → blue-600 (135°) | None (decoration: logo mark, dividers, icon backgrounds behind navy icons only on the teal end) |
| `bg-accent-gradient` | teal-400 → sky-400 (135°) | navy-900 |
| `bg-deep-gradient` | navy-900 → navy-800 (135°) | white, teal-300 |
| `bg-soft-gradient` | teal-50 → blue-50 (180°) | navy-900, ink, muted, teal-700 |

## 2. Typography

- Headings: Plus Jakarta Sans (variable, weights 600–800), via `next/font/google`, CSS variable mapped to `font-heading`.
- Body: Inter (variable), mapped to `font-sans`. Both `display: swap`, `subsets: ["latin"]`.
- Scale (mobile → desktop): hero `clamp(2.25rem, 1.6rem + 3vw, 3.75rem)`, section title 1.75rem → 2.25rem, card title 1.125rem, body 1rem (16 px minimum), small text 0.875rem (never below 14 px).
- Line height 1.6 body, 1.15–1.25 headings. Maximum line length 68 characters in text blocks.
- All headings navy-900; eyebrow labels teal-700, uppercase, letter-spacing 0.08em, 0.8125rem.

## 3. Shape, elevation, spacing

| Token | Value | Use |
|-------|-------|-----|
| `radius-control` | 0.75rem | Buttons, chips, menu items |
| `radius-card` | 1.25rem | Cards, images |
| `radius-pill` | 999px | Badges, pill buttons |
| `shadow-soft` | 0 1px 2px + 0 8px 24px, navy at 4% / 6% (via `color-mix`) | Default card |
| `shadow-lift` | 0 2px 4px + 0 16px 40px, navy at 6% / 10% | Hover, floating hero cards, sticky header when scrolled |
| Container | max-width 75rem (1200 px), horizontal padding 1rem (mobile) / 1.5rem (md) / 2rem (xl) | All sections |
| Section spacing | 4rem (mobile) / 6rem (lg) vertical | Between Home sections |

Breakpoints are Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280); design starts at 320 px and adds `min-width` rules (mobile-first).

## 4. Brand identity

- **Mark**: rounded-square plus sign (arms with rounded ends) filled with a diagonal teal-500 → navy-900 gradient; a white heartbeat polyline crosses the center, and its rise/fall path reads as an "S". Original geometry; no other organization's symbol or lettering. Stops reference `var(--color-teal-500)` and `var(--color-navy-900)`.
- **Wordmark**: "Shuaib" navy-900 + "Health" teal-600, heading font weight 800, tight tracking; tagline "Clinic & Diagnostics" may appear under the wordmark in the footer only.
- **Variants**: `Logo` (mark + wordmark, `size` sm/md/lg) and `LogoMark` (mark only, used for the favicon and compact spaces). Minimum sizes: mark 24 px, full logo 120 px wide.
- **Accessibility**: the link wrapping the header logo has the accessible name "Shuaib Health home"; the SVG is `aria-hidden` and the wordmark text is real text. Gradient ids are unique per instance (`useId`).
- **Favicon/app icon**: `app/icon.svg` from the same path data (drift-guard test); 180×180 touch icon from `apple-icon.tsx` if it renders faithfully.

## 5. Layout shell

```text
[Skip to main content]            (first focusable, visible on focus)
[Notice bar]  Portfolio demo — not a real clinic, not medical advice.     (not sticky)
[Header — sticky]  Logo | (≥1280) nav ×8 | Emergency phone | Book Appointment | (<1280) menu button
[Mobile menu panel] nav ×8, emergency phone, Book Appointment              (disclosure)
<main id="main-content"> … page … </main>
[Footer]  4 columns | bottom row
```

**Notice bar**: full width, navy-900 background, white 0.8125rem text centered, height ≈ 32 px, wraps to two lines on 320 px without clipping.

**Header** (height 64 px mobile, 72 px desktop, white with a 1 px `border` line, `shadow-lift` after scroll):
- < 768 px: logo (wordmark stays visible), call icon button (44×44, `aria-label="Call emergency phone"`), compact "Book" button from 375 px up (`aria-label="Book Appointment"`), menu button (44×44).
- 768–1279 px: logo, emergency phone (icon + number), Book Appointment button, menu button.
- ≥ 1280 px: logo, eight nav links, emergency phone, Book Appointment button. Active link: navy text with a teal-500 underline bar (also `aria-current="page"`; not color alone).

**Mobile menu**: opens as a panel under the header, scrollable, max height `100dvh − header`; links are 48 px tall targets; contains the eight links, emergency phone and a full-width Book Appointment button. Escape or outside tap closes it; focus returns to the menu button; route change closes it.

**Footer**: navy-900 background, white and teal-300 text. Four columns from `lg` (2 columns at `sm`, stacked below): (1) logo + short intro (one sentence, no claims), (2) Quick links, (3) Departments (seven links), (4) Contact (sample address, sample phone, hours with "PKT", a "Sample details" label). Bottom row: "© {year} Shuaib Health", Privacy, Terms, the demo notice text, and "Designed & built by Shuaib Ali" linking to `https://github.com/Shuaibali0786`. The year is fixed at build time from a constant (not `new Date()` at render) to avoid hydration differences.

## 6. Home sections (visual spec)

| # | Section | Layout | Notes |
|---|---------|--------|-------|
| 1 | Hero | Mobile: text, buttons, then image with the three fact cards stacked below. `lg`: two columns, image right, cards floating over its edges | Background `bg-soft-gradient`; H1 in navy-900; primary button navy/white; secondary outlined navy. Image 4:5 `priority`. Cards use `shadow-lift`, icon in `bg-teal-100` tile with navy icon |
| 2 | How can we help you? | Compact cards (smaller padding and icon) in 2 columns on phones (5th item spans both), 5 columns on `lg` | Each action: icon tile, label, one-line description; entire card is one link |
| 3 | Departments | Compact cards in 2 columns on phones (two-line summary, no "Learn more" row), 2 columns `sm`, 3 columns `lg`, 4 on `xl` (7 cards, last row partly filled) | Card: image 4:3, name (h3), one line, arrow link. Card hover lifts 2 px unless reduced motion |
| 4 | Honest facts band | `bg-deep-gradient`, 2×2 on phones, 4 across on `lg` | Value in teal-300 heading font, label in white. No counts of patients, awards, ratings |
| 5 | Why choose us + Emergency | Mobile: image, list, then Emergency card. `lg`: list left, image right, Emergency card spans below | 4–5 points with teal-100 icon tiles; Emergency card `danger-50` background, danger-700 heading and icon, `tel:` button (white on danger-700), and the sentence advising the nearest ER |
| 6 | Featured doctors | Swipe row on phones (snap scrolling, 78% wide cards so the next one peeks), 2 columns `sm`, 4 on `xl` | Card: photo 4:5, "Sample" badge, name, specialty, "PKR n" fee, "View profile" |
| 7 | Health Tips | Swipe row on phones (as doctors), 2 columns `sm`, 3 columns `lg` | Card: image 16:10, category, title (h3), date (Karachi), "Sample" badge, summary |
| 8 | CTA band | `bg-deep-gradient`, centered | H2 "Book your appointment", one line of text, accent button (`bg-accent-gradient`, navy text). Focus ring uses teal-300 here |

Sections alternate `background` and `surface` for calm rhythm. Each section has one `h2` (except the hero `h1`); card titles are `h3`.

## 7. Components (behavior contract)

- **Button**: renders `<Link>` (or `<a>` for `tel:`); variants `primary` (navy/white), `accent` (accent-gradient/navy), `outline` (navy border/navy text, hover surface), `danger` (danger-700/white), `onDark` (white/navy). Minimum height 44 px on touch (≥ 24 px is the AA floor), visible focus ring, pressed state without movement under reduced motion.
- **Card**: `radius-card`, `shadow-soft`, 1 px `border`. Clickable cards use one primary link with a stretched hit area (the heading link), never nested links.
- **SampleBadge**: pill, `teal-50` background, teal-700 text, 1 px teal-700 border, text "Sample". Not color-only (word is present).
- **SectionHeading**: optional eyebrow (teal-700), `h2`, optional intro (muted).
- **IconTile**: 48 px rounded tile, decorative icon `aria-hidden`.
- **Reveal**: wrapper implementing R3; props `delay`, `offsetY` (default 16 px), `as`.
- **ImageWithFallback**: wraps `next/image`; on error shows a neutral `surface` block of the same aspect ratio with the alt text as a visible caption label; no broken-image icon.
- **MobileMenu / NavLinks**: as in section 5; `NavLinks` is a client component only to read the pathname.

## 8. Motion

| Interaction | Effect | Duration / easing | Reduced motion |
|-------------|--------|-------------------|----------------|
| Section reveal | Fade in + 16 px rise, once | 0.5 s, `--ease-soft` (cubic-bezier .22, 1, .36, 1), 0.06 s stagger between cards, max 0.3 s total delay | Opacity only (or none); no movement |
| Card hover | −2 px lift and `shadow-lift` | 0.2 s | No lift; shadow change allowed |
| Menu open | Height/opacity fade | 0.2 s | Instant |
| Button press | Slight color change | 0.15 s | Same (no scale) |

Nothing autoplays, loops, or moves continuously. Header scroll shadow is a class toggle, not an animation.

## 9. Accessibility rules baked into the design

- Skip link, landmarks (`header`, `nav` with an accessible name, single `main`, `footer`), one `h1` per page, ordered headings.
- Focus ring 2 px + 2 px offset on every interactive element; never removed; `scroll-padding-top` equals the header height so focus is not hidden by the sticky header (WCAG 2.2 focus not obscured).
- Targets ≥ 44 px on touch layouts (minimum 24 px everywhere).
- Every meaningful image has alt text; decorative icons are `aria-hidden`; icon-only buttons have `aria-label`.
- Links are underlined or otherwise distinguishable beyond color inside body text; the `lang="en"` attribute is set.
- Content reflows at 320 px and at 200% zoom; no horizontal scrolling.
- Phone numbers use `tel:` links and readable text.

## 10. Guardrails (automated)

| Rule | Check |
|------|-------|
| Hex values only in `globals.css` and `icon.svg` | `tests/unit/tokens.test.ts` scans `src/components` and `src/app` |
| All approved pairs meet AA | Same test computes ratios from `globals.css` |
| No raw `<img>` | ESLint (`@next/next/no-img-element`) plus a text scan |
| No horizontal overflow at 320/390/1280 | Playwright `responsive.spec` |
| axe WCAG 2.2 AA clean | Playwright `a11y.spec` |
