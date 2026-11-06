# Showcase screenshots (Fiverr gallery)

Taken on 7 Nov 2026 with Playwright against a **local production build** of `main` plus draft PRs #23, #24 and #25, using the **mock API** (sample data only, nothing from production). The assistant was switched on (`ASSISTANT_ENABLED=true`) for this local build only. Desktop is 1440 × 900; mobile is a Pixel 7 (412 px wide). Files were shrunk with `sharp` (palette PNG); tall mobile pages are 540 px wide.

The fake booking used the name "Sana Example" and 0300 1234567. Every page shows the "Portfolio demo" notice.

## Specialty presets (PR #24)
| Preset | First screen | Full page | Booking, slip and dashboard previews |
|---|---|---|---|
| Dental | `preset-dental-home-{desktop,mobile}.png` | `preset-dental-full-*.png` | `preset-dental-booking-slip-dashboard-*.png` |
| Skin & Aesthetic | `preset-skin-aesthetic-home-*.png` | `preset-skin-aesthetic-full-*.png` | `preset-skin-aesthetic-booking-slip-dashboard-*.png` |
| Diagnostic Lab | `preset-diagnostic-lab-home-*.png` | `preset-diagnostic-lab-full-*.png` | `preset-diagnostic-lab-booking-slip-dashboard-*.png` |
| Multi-speciality | `preset-multi-speciality-home-*.png` | `preset-multi-speciality-full-*.png` | `preset-multi-speciality-booking-slip-dashboard-*.png` |

## Real flows (the same for every preset today)
| Screen | Files |
|---|---|
| Booking: choose department | `booking-step1-{desktop,mobile}.png` |
| Booking: choose date | `booking-step2-date-*.png` |
| Confirmation slip (QR, masked details) | `slip-*.png` |
| Command Centre overview | `dashboard-overview-*.png` |
| Bookings with quick date ranges (PR #23) | `dashboard-bookings-*.png` |
| Insights | `dashboard-insights-*.png` |
| Roles and permissions (PR #23) | `dashboard-roles-*.png` |
| Assistant, patient question (PR #25) | `assistant-patient-*.png` |
| Assistant, clinic-owner guide (PR #25) | `assistant-owner-*.png` |

Note: booking, slip and dashboard are **not preset-aware** yet; they show the shared sample clinic. Each preset page has labelled previews of them. Making the real flows preset-aware is a question for Shuaib.

## Re-take
1. Merge the three branches into a local branch (do not push it), build with the mock API and `ASSISTANT_ENABLED=true`.
2. Serve with `next start --port 3100` next to `node tests/mock-api/server.mjs` (see `playwright.config.ts` for the env).
3. Run [`capture-showcase.mjs`](capture-showcase.mjs) from `frontend/` (instructions at the top of the file).

Video: [`DEMO-VIDEO-SCRIPT.md`](DEMO-VIDEO-SCRIPT.md).
