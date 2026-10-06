# Command Centre design preview (FR-039)

Approved at the design gate with **font A (Cormorant Garamond)** for headings and KPI numerals.
Static HTML with no build step and no feature code. Sample data only (FR-038).

- `index.html`: comparison board (theme, screen, desktop width 1440/1366/1280, live or start-at-11:20 clock).
- `preview.html?screen=overview|bookings&state=list|drawer|confirm&theme=light|dark|system&at=HH:MM`: one variant at full size.
- `screenshots/`: 46 PNGs named `<view>_<device>_<theme>.png`, for devices `phone` (390), `laptop-1280`, `laptop-1366` and `desktop` (1440).
- `capture.mjs`: regenerates the screenshots with the Playwright copy in `frontend/`.

Open `index.html` by double-clicking it. Fonts load from Google Fonts, so you need to be online.

## What is live

- **Clock**: real Asia/Karachi time with seconds, e.g. `11:20:45 AM · Karachi`, and a greeting that follows it (Good morning / afternoon / evening).
- **Refresh**: KPIs and lists refresh every 30 s, and again when the tab becomes visible. A pulsing "Live" dot shows "updated just now / 20 s ago". KPI numbers count up on load. The "Now" line and the phone agenda's Now marker move every minute.
- **New bookings**: in demo mode a booking is simulated after 50 s, then every 75 s. It shows a toast (View booking, Dismiss, pauses on hover or focus) and a gold glow on the agenda chip.
- **Agenda chips**: buttons with aria-labels. Hover, focus or tap shows time, patient initials and status (Esc dismisses). Clicking opens the booking drawer, with focus kept inside and returned on close. Patient names in the table, booking cards and phone agenda rows open it too.
- **Theme**: Light / Night / Auto in the sidebar (a cycle button on phones) switches the theme, follows the device in Auto, and is remembered (`localStorage` here; the real app uses the `cc_theme` cookie).
- **Reduced motion**: no count-up, pulse, glow, slide or line animation.

Sample patients fit their department: Gynecology patients are women; Pediatrics patients are children (0–12) booked by a mother or father, shown in the drawer as "4 years · booked by mother". Visit reasons are per department.

## Screenshots and the clipping check

From the repo root:

```
node specs/006-clinic-command-centre/design-preview/capture.mjs
```

Every shot gets a fresh page whose Playwright clock is paused at **Mon 5 Oct 2026, 11:20:45 Karachi**. The script moves it 1.2 s forward for the count-up and disables CSS animations, so repeated runs produce identical files. Overview and Bookings are checked at every width: the script exits with an error if the page scrolls sideways, a clipping box hides content, or a text box spills out of itself.
