# Credits and licences

Every image, icon, font and map used on the Shuaib Health site, with its source and licence.
Audit date: 7 Nov 2026. Photo sources verified and two photos replaced on 8 Nov 2026.

**Legend:** ✅ clear free-commercial licence · ⚠️ needs the owner to confirm · ❌ no usable licence evidence (replace or prove)

## Summary

| Kind | Count | Status |
|---|---|---|
| Photos (`frontend/public/images/**.jpg`) | 24 | ✅ all from Pexels, each page linked below (2 replaced on 8 Nov 2026) |
| Logo, favicon, touch icon, OG images | own | ✅ own work (code-drawn SVG / `next/og`) |
| Icons (`lucide-react` 1.49.0) | library | ✅ ISC licence |
| Fonts (Plus Jakarta Sans, Inter, Cormorant Garamond) | 3 families | ✅ SIL Open Font License 1.1 |
| Map (OpenStreetMap embed, opt-in) | 1 | ✅ ODbL data, attribution shown inside the embed |
| Screenshots (`docs/showcase/`, `docs/portfolio/`) | own | ✅ own work, sample data only |

## Photos

All 24 photos are from **Pexels**. Each one's page was opened on 8 Nov 2026 and shows the Pexels licence
(<https://www.pexels.com/license/>): free for commercial and personal use, no attribution required; do not sell
unaltered copies, do not imply that people shown endorse a product, do not show identifiable people in a bad light.

**How each source was proven:** the original in `assets/photos/` (git-ignored) has exactly the same pixel size as
the Pexels upload, and a 32×32 greyscale comparison of the two differs by under 2/255 on average (different photos,
even from the same shoot, score 15–75). Where the file's own XMP creator differs from the Pexels credit, both are shown.

**Replaced on 8 Nov 2026** (approvals A2 and A3 of the overnight report):
- `dr-bilal-ansari.jpg`: the old file was a 675×537 PNG screenshot with no traceable source. The new photo has the
  same look as the other doctor cards (white coat, glasses, stethoscope, light background). Its alt text was updated
  in the seed data and test fixtures; **the live site keeps the old alt text until the catalog is next re-seeded**,
  because no database changes were allowed.
- `general-medicine.jpg`: the old file's metadata said "Use with the permission of the artist". The new photo is a
  consultation scene from RDNE Stock project and still matches the existing alt text ("Doctor reviewing a folder
  with a patient in a consultation room").

| Public file | Original (`assets/photos/`) | Photographer (Pexels credit) | Pexels page | Licence |
|---|---|---|---|---|
| `images/hero/hero-doctor.jpg` | `hero.jpg.jpg` | cottonbro studio | [7578811](https://www.pexels.com/photo/smiling-doctor-by-table-7578811/) | ✅ Pexels |
| `images/clinic/clinic-interior.jpg` | `clinic.jpg.jpg` | Pavel Danilyuk | [7108325](https://www.pexels.com/photo/couple-looking-at-documents-in-reception-of-medical-center-7108325/) | ✅ Pexels |
| `images/departments/general-medicine.jpg` | — (**replaced 8 Nov 2026**) | RDNE Stock project | [6129441](https://www.pexels.com/photo/male-doctor-talking-to-a-patient-6129441/) | ✅ Pexels |
| `images/departments/cardiology.jpg` | `cardio.jpg.jpg` | Karolina Grabowska (Kaboompics) | [5207117](https://www.pexels.com/photo/portrait-of-smiling-doctor-holding-heart-5207117/) | ✅ Pexels |
| `images/departments/pediatrics.jpg` | `pediatrics.jpg.jpg` | Pavel Danilyuk | [5998457](https://www.pexels.com/photo/a-doctor-examining-a-child-patient-5998457/) | ✅ Pexels |
| `images/departments/gynecology.jpg` | `gyne.jpg.jpg` | Thirdman (file XMP: Alex Saharchuk) | [7659690](https://www.pexels.com/photo/a-woman-with-stethoscope-writing-on-paper-beside-a-woman-with-headscarf-7659690/) | ✅ Pexels |
| `images/departments/dermatology.jpg` | `derma.jpg.jpg` | Gustavo Fring (file XMP: FaustFoto) | [7446672](https://www.pexels.com/photo/doctor-examining-patient-using-a-gadget-7446672/) | ✅ Pexels |
| `images/departments/dental.jpg` | `dental.jpg.jpg` | Nadezhda Moryak | [7800666](https://www.pexels.com/photo/man-and-woman-looking-on-a-monitor-7800666/) | ✅ Pexels |
| `images/departments/pathology-lab.jpg` | `lab.jpg.jpg` | Karolina Grabowska (Kaboompics) | [8539523](https://www.pexels.com/photo/woman-doing-an-experiment-8539523/) | ✅ Pexels |
| `images/doctors/dr-ayesha-rahman.jpg` | `ayesha.jpg.jpg` | Gustavo Fring | [4173249](https://www.pexels.com/photo/positive-doctor-in-medical-uniform-talking-on-cellphone-in-clinic-corridor-4173249/) | ✅ Pexels |
| `images/doctors/dr-imran-qureshi.jpg` | `imran.jpg.jpg` | Oys Photography | [19438558](https://www.pexels.com/photo/docto-19438558/) | ✅ Pexels |
| `images/doctors/dr-sana-farooqui.jpg` | `sana.jpg.jpg` | Thirdman | [5327580](https://www.pexels.com/photo/healthcare-professional-in-white-uniform-with-stethoscope-hanging-on-her-neck-holding-a-book-while-looking-at-the-camera-5327580/) | ✅ Pexels |
| `images/doctors/dr-hassan-mirza.jpg` | `hassan.jpg.jpg` | Usman Yousaf | [6762876](https://www.pexels.com/photo/a-man-in-white-coat-6762876/) | ✅ Pexels |
| `images/doctors/dr-maryam-baloch.jpg` | `dr-maryam-baloch.jpg.jpg` | Antoni Shkraba | [6749773](https://www.pexels.com/photo/a-woman-wearing-a-stethoscope-6749773/) | ✅ Pexels |
| `images/doctors/dr-bilal-ansari.jpg` | — (**replaced 8 Nov 2026**) | Tran Nhu Tuan | [15962798](https://www.pexels.com/photo/smiling-young-doctor-15962798/) | ✅ Pexels |
| `images/doctors/dr-zainab-memon.jpg` | `dr-zainab-memon.jpg.jpg` | Mikhail Nilov | [8851711](https://www.pexels.com/photo/woman-wearing-laboratory-gown-doing-experiment-8851711/) | ✅ Pexels |
| `images/doctors/dr-omar-sheikh.jpg` | `dr-omar-sheikh.jpg.jpg` | Los Muertos Crew | [8460090](https://www.pexels.com/photo/a-doctor-wearing-a-white-coat-8460090/) | ✅ Pexels |
| `images/doctors/dr-faisal-chaudhry.jpg` | `dr-faisal-chaudhry.jpg.jpg` | Lucas Guimarães Bueno | [13060625](https://www.pexels.com/photo/a-doctor-holding-a-measuring-tape-13060625/) | ✅ Pexels |
| `images/tips/staying-hydrated.jpg` | `water.jpg.jpg` | Wallace Chuck | [3500006](https://www.pexels.com/photo/clear-glass-pitcher-pouring-water-on-clear-drinking-glass-3500006/) | ✅ Pexels |
| `images/tips/healthy-sleep-habits.jpg` | `sleep.jpg.jpg` | Vitaly Gariev | [36729598](https://www.pexels.com/photo/peaceful-sleep-woman-resting-in-comfortable-bed-36729598/) | ✅ Pexels |
| `images/tips/balanced-plate.jpg` | `food.jpg.jpg` | Gül Işık | [20123612](https://www.pexels.com/photo/top-view-of-a-bowl-with-a-healthy-breakfast-20123612/) | ✅ Pexels |
| `images/tips/daily-walk.jpg` | `walk.jpg.jpg` | Mushfiqur Rahman (file XMP: tusher) | [35460207](https://www.pexels.com/photo/peaceful-morning-walk-in-lush-park-35460207/) | ✅ Pexels |
| `images/tips/hand-hygiene.jpg` | `hand-hygiene.jpg.jpg` | Anna Shvets | [3943901](https://www.pexels.com/photo/person-washing-hands-3943901/) | ✅ Pexels |
| `images/tips/managing-stress.jpg` | `managing-stress.jpg.jpg` | Karolina Grabowska (Kaboompics) | [4498214](https://www.pexels.com/photo/young-woman-sitting-in-lotus-pose-during-meditation-at-home-4498214/) | ✅ Pexels |

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
