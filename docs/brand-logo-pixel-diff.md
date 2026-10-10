# Brand logo: pixel-diff report (Booking Plus)

Old baselines: `D:\shuaib-health-baseline-backup\old-baselines\` (kept outside the repo; they are also in git history on `main`).
Diff images (changed pixels in red over the new page): `D:\shuaib-health-baseline-backup\diff\`.
Method: a pixel counts as changed when any colour channel differs by more than 16/255. The percent is of the whole screenshot, so a full-page shot of a long page shows a small number even though the logo area changed completely.

## Summary

- Screenshots compared: 139. Changed: 135. Unchanged: 4 (the dark-theme confirmation dialog, which has no logo in view).
- Public site: 62 shots, all changed. Mean 2.02 %, max 5.18 %. On desktop the changes sit inside the header logo (top-left) and the footer (logo and the new "Powered by" line); desktop page heights are unchanged.
- Public site, mobile: every page is 31 px taller, because the new "Powered by Shuaib Health" line wraps onto its own row in the stacked footer. The header height is unchanged (the header specs pass at 320 to 430 px).
- Command Centre: 76 shots. The changes are the sidebar or top-bar logo and the footer line. Full-page shots are 4 px taller (the 16 px mark makes the footer row slightly taller than text alone).
- Slip PDF: 1.04 % changed, which is the header mark (new mark on the navy band) and the faint watermark. The double-ring stamp is unchanged.

## Per page

| Area | Page | Shots | Mean % | Max % | Height change |
|---|---|---|---|---|---|
| Command Centre | activity-dark | 4 | 0.38 | 0.44 | +4 px |
| Command Centre | activity-light | 4 | 0.40 | 0.47 | +4 px |
| Command Centre | bookings-confirm-dark | 4 | 0.00 | 0.00 | none |
| Command Centre | bookings-confirm-light | 4 | 0.20 | 0.26 | none |
| Command Centre | bookings-dark | 4 | 0.44 | 0.52 | +4 px |
| Command Centre | bookings-drawer-dark | 4 | 0.21 | 0.26 | none |
| Command Centre | bookings-drawer-light | 4 | 0.21 | 0.26 | none |
| Command Centre | bookings-light | 4 | 0.46 | 0.54 | +4 px |
| Command Centre | doctors-dark | 4 | 0.81 | 1.04 | +4 px |
| Command Centre | doctors-light | 4 | 0.85 | 1.08 | +4 px |
| Command Centre | insights-7-focus-dark | 3 | 0.64 | 0.66 | +4 px |
| Command Centre | insights-7-focus-light | 3 | 0.67 | 0.69 | +4 px |
| Command Centre | insights-dark | 4 | 0.55 | 0.66 | +4 px |
| Command Centre | insights-light | 4 | 0.57 | 0.69 | +4 px |
| Command Centre | overview-chip-dark | 3 | 0.11 | 0.12 | none |
| Command Centre | overview-chip-light | 3 | 0.11 | 0.12 | none |
| Command Centre | overview-dark | 4 | 0.56 | 0.69 | +4 px, +5 px |
| Command Centre | overview-light | 4 | 0.58 | 0.71 | +4 px, +5 px |
| Command Centre | overview-new-booking-dark | 4 | 0.35 | 0.72 | none |
| Command Centre | overview-new-booking-light | 4 | 0.26 | 0.50 | none |
| Public site | about | 2 | 1.27 | 2.20 | +31 px |
| Public site | book-appointment | 2 | 2.33 | 3.97 | +31 px |
| Public site | contact | 2 | 1.85 | 3.19 | +31 px |
| Public site | departments | 2 | 2.70 | 4.64 | +31 px |
| Public site | departments-cardiology | 2 | 1.62 | 2.85 | +31 px |
| Public site | departments-dental | 2 | 1.71 | 2.98 | +31 px |
| Public site | departments-dermatology | 2 | 1.63 | 2.86 | +31 px |
| Public site | departments-general-medicine | 2 | 1.46 | 2.52 | +31 px |
| Public site | departments-gynecology | 2 | 1.55 | 2.71 | +31 px |
| Public site | departments-pathology-lab | 2 | 1.52 | 2.63 | +31 px |
| Public site | departments-pediatrics | 2 | 1.52 | 2.64 | +31 px |
| Public site | doctors | 2 | 1.55 | 2.68 | +31 px |
| Public site | doctors-dr-ayesha-rahman | 2 | 2.48 | 4.18 | +31 px |
| Public site | doctors-dr-bilal-ansari | 2 | 2.48 | 4.18 | +31 px |
| Public site | doctors-dr-faisal-chaudhry | 2 | 2.46 | 4.15 | +31 px |
| Public site | doctors-dr-hassan-mirza | 2 | 2.47 | 4.18 | +31 px |
| Public site | doctors-dr-imran-qureshi | 2 | 2.47 | 4.18 | +31 px |
| Public site | doctors-dr-maryam-baloch | 2 | 2.48 | 4.18 | +31 px |
| Public site | doctors-dr-omar-sheikh | 2 | 2.47 | 4.18 | +31 px |
| Public site | doctors-dr-sana-farooqui | 2 | 2.46 | 4.15 | +31 px |
| Public site | doctors-dr-zainab-memon | 2 | 2.46 | 4.15 | +31 px |
| Public site | faq | 2 | 1.98 | 3.47 | +31 px |
| Public site | health-packages | 2 | 1.39 | 2.28 | +31 px |
| Public site | health-tips | 2 | 1.78 | 2.89 | +31 px |
| Public site | home | 2 | 0.96 | 1.68 | +31 px |
| Public site | lab-tests | 2 | 0.76 | 1.21 | +31 px |
| Public site | lab-tests-blood-group-rh | 2 | 3.02 | 5.18 | +31 px |
| Public site | lab-tests-complete-blood-count | 2 | 2.83 | 4.86 | +31 px |
| Public site | lab-tests-esr | 2 | 2.99 | 5.11 | +31 px |
| Public site | privacy | 2 | 1.70 | 2.96 | +31 px |
| Public site | terms | 2 | 2.17 | 3.75 | +31 px |
| Slip PDF | slip-pdf | 1 | 1.04 | 1.04 | none |

## Round 2 (owner review of PR #7): wordmark, spacing, watermark

Compared with the baselines in the first commit of this PR (backup: `D:\shuaib-health-baseline-backup\r1-baselines\`; diff images in `D:\shuaib-health-baseline-backup\diff-r2\`). 139 shots compared, 62 changed, 77 unchanged.

- Public site, desktop: 31 shots, mean 0.45 %, max 0.65 %. The changes are the header logo (now "Shuaib Health" with a space) and the footer logo; page heights are unchanged.
- Public site, mobile: 31 shots, mean 2.7 %, max 4.0 %. Every page is 4 px taller than in round 1, because the footer logo is larger (40 px mark, 32 px type).
- Command Centre: 0 of 76 changed. One dark new-booking shot moved on regeneration through timing noise, so I reverted it to the committed image.
- Slip PDF: the baseline still passes within its 0.2 % tolerance, so I refreshed it by hand. At a one-level colour tolerance, 3.9 % of pixels differ, all inside the watermark box (x 310 to 529, y 538 to 769). The header, stamp, QR and text are untouched.
