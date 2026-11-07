# Credits and licences

Every image, icon, font and map used on the Shuaib Health site, with its source and licence.
Audit date: 7 Nov 2026 (read-only audit; no files were changed except this one).

**Legend:** ✅ clear free-commercial licence · ⚠️ needs the owner to confirm · ❌ no usable licence evidence (replace or prove)

## Summary

| Kind | Count | Status |
|---|---|---|
| Photos (`frontend/public/images/**.jpg`) | 24 | Stated source Pexels; **per-photo source links were never recorded**. 1 ❌, 1 ⚠️ needs proof, 22 ⚠️ needs links |
| Logo, favicon, touch icon, OG images | own | ✅ own work (code-drawn SVG / `next/og`) |
| Icons (`lucide-react` 1.49.0) | library | ✅ ISC licence |
| Fonts (Plus Jakarta Sans, Inter, Cormorant Garamond) | 3 families | ✅ SIL Open Font License 1.1 |
| Map (OpenStreetMap embed, opt-in) | 1 | ✅ ODbL data, attribution shown inside the embed |
| Screenshots (`docs/showcase/`, `docs/portfolio/`) | own | ✅ own work, sample data only |

## Photos

The owner supplied the photos from **Pexels** (`specs/001-brand-home-page/image-manifest.md`, `.gitignore`).
Pexels licence: free for commercial and personal use, no attribution required; do not sell unaltered copies,
do not imply that people shown endorse a product, do not show identifiable people in a bad light.
Originals are in `assets/photos/` (git-ignored). The "Embedded creator" column comes from each original's
XMP metadata (read with `sharp`); an empty cell means the file carries no creator field.

| Public file | Original | Embedded creator | Status |
|---|---|---|---|
| `images/hero/hero-doctor.jpg` | `hero.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/clinic/clinic-interior.jpg` | `clinic.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/departments/general-medicine.jpg` | `general.jpg.jpg` | Ana Karotkaya Photography — XMP usage terms: **"Use with the permission of the artist"** | ⚠️ **prove** it came from Pexels (the Pexels licence then applies); otherwise replace |
| `images/departments/cardiology.jpg` | `cardio.jpg.jpg` | Karolina Grabowska / Kaboompics | ✅ likely (Kaboompics and Pexels are both free-commercial); add link |
| `images/departments/pediatrics.jpg` | `pediatrics.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/departments/gynecology.jpg` | `gyne.jpg.jpg` | Alex Saharchuk | ⚠️ add Pexels link |
| `images/departments/dermatology.jpg` | `derma.jpg.jpg` | FaustFoto | ⚠️ add Pexels link |
| `images/departments/dental.jpg` | `dental.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/departments/pathology-lab.jpg` | `lab.jpg.jpg` | Karolina Grabowska / Kaboompics | ✅ likely; add link |
| `images/doctors/dr-ayesha-rahman.jpg` | `ayesha.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-imran-qureshi.jpg` | `imran.jpg.jpg` | OYS Photography (rights: Oys Kuruni) | ⚠️ add Pexels link |
| `images/doctors/dr-sana-farooqui.jpg` | `sana.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-hassan-mirza.jpg` | `hassan.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-maryam-baloch.jpg` | `dr-maryam-baloch.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-bilal-ansari.jpg` | `dr-bilal-ansari.jpg.png` | **none; 675×537 PNG with black borders, no camera data** | ❌ looks like a screenshot or a frame from elsewhere, not a Pexels download. **Replace** or find the source |
| `images/doctors/dr-zainab-memon.jpg` | `dr-zainab-memon.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-omar-sheikh.jpg` | `dr-omar-sheikh.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/doctors/dr-faisal-chaudhry.jpg` | `dr-faisal-chaudhry.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/tips/staying-hydrated.jpg` | `water.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/tips/healthy-sleep-habits.jpg` | `sleep.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/tips/balanced-plate.jpg` | `food.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/tips/daily-walk.jpg` | `walk.jpg.jpg` | tusher | ⚠️ add Pexels link |
| `images/tips/hand-hygiene.jpg` | `hand-hygiene.jpg.jpg` | none | ⚠️ add Pexels link |
| `images/tips/managing-stress.jpg` | `managing-stress.jpg.jpg` | Karolina Grabowska / Kaboompics | ✅ likely; add link |

**How to close the ⚠️ rows (owner, about 30 minutes):** for each photo, find its Pexels page (Pexels search or a
reverse image search on the original), and paste the URL into the table. A row is ✅ when the link opens a Pexels
page from the same photographer.

**Use of model photos as sample doctors:** the doctor photos show stock models under made-up doctor names. The alt
text already says "Stock photo of a model presented as sample doctor …", and the site says these are sample
doctors. This fits the Pexels licence (no endorsement, not a bad light). Keep the "Sample" badges.

## Brand and generated images (own work) ✅

- `frontend/src/app/icon.svg`, `frontend/public/images/brand/logo-mark.svg`: hand-drawn SVG rectangles.
- `frontend/src/app/apple-icon.tsx`, every `opengraph-image.tsx`: drawn at request time with `next/og` from the
  brand marks; no photos or third-party art.
- Wordmark outlines (`frontend/src/components/brand/wordmark-paths.ts`): glyph outlines of Cormorant Garamond 700
  (OFL 1.1, see below). The OFL allows this.

## Icons ✅

- [Lucide](https://lucide.dev) via `lucide-react` 1.49.0: **ISC licence** (permissive, commercial use allowed).
  No other icon set is used.

## Fonts ✅ (SIL Open Font License 1.1)

| Font | Files | Use |
|---|---|---|
| Plus Jakarta Sans | `frontend/src/fonts/plus-jakarta-sans-latin-variable.woff2`, `frontend/public/fonts/slip/plus-jakarta-sans-bold.ttf` | site headings, booking slip PDF |
| Inter | `frontend/src/fonts/inter-latin-variable.woff2`, `frontend/public/fonts/slip/inter-*.ttf` | body text, staff app, slip PDF |
| Cormorant Garamond | `frontend/src/fonts/cormorant-garamond-latin-variable.woff2` | staff app display type, wordmark outlines |

All three are Google Fonts families under the OFL 1.1, which allows bundling, subsetting and redistribution
(the font may not be sold on its own). Details: `frontend/src/fonts/README.md`, `frontend/scripts/subset-slip-fonts.mjs`.

## Map ✅

The Contact page can show an OpenStreetMap embed after the visitor presses "Show map"
(`frontend/src/components/contact/MapEmbed.tsx`). Map data © OpenStreetMap contributors (ODbL); the embed shows
the attribution itself, and the page links to openstreetmap.org.

## Code libraries

Runtime libraries (Next.js, React, framer-motion, zod, react-hook-form, Sentry SDK) are MIT or similar permissive
licences; see `frontend/package-lock.json` and `backend/uv.lock`.
