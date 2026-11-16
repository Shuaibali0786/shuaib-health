# Portfolio and gig assets

Everything here is built from the demo clinic's sample data: the patient is "Sample Patient" with a made-up number, no browser
chrome, and the demo labels stay on screen. Captured from the local production build against the mock API, so no booking was made in
any real database. Images are 1280 x 769 (the Fiverr gig gallery size).

| File | What it shows |
|---|---|
| `gig-1-home-hero.png` | Home hero: one slim demo banner, Book Appointment, Talk to Ayesha, the trust strip |
| `gig-2-voice-panel.png` | Voice mode in the middle of a booking (allergy, Dr. Maryam, the booking summary filling in) |
| `gig-3-booking-confirm-card.png` | The summary the patient checks before confirming |
| `gig-4-appointment-slip.png` | The appointment slip page (reference, QR code, PDF; details masked) |
| `gig-5-staff-dashboard-demo.png` | The staff dashboard in demo mode |
| `gig-6-mobile-view.png` | The phone view on a clean backdrop |
| `demo-video-draft.webm` | About one minute, 1280 x 720, silent, with captions: home, chat, typed English booking, slip, demo dashboard |
| `case-study.md` | One-page project case study |

## The video is a draft, in WebM

Playwright records WebM. To make an MP4 for upload, with [ffmpeg](https://ffmpeg.org/) installed:

```
ffmpeg -i demo-video-draft.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart demo-video-draft.mp4
```

Add the voice-over (or music) in any editor; the captions are burned into the picture.

## Re-capture

```
cd frontend
ASSISTANT_ENABLED=true VOICE_ENABLED=true DEMO_ENABLED=true MOCK_NOW=2026-11-15T05:00:00Z \
  npx playwright test -c playwright.marketing.config.ts
```

On Windows PowerShell set the four variables with `$env:NAME = "value"` first. `MOCK_NOW` is the mock API's clock, so the booking
dates match the "booked on" date on the slip. The staff dashboard shows the recorded demo day (a fixed sample day), as it does on the live demo.
The spec is `frontend/tests/marketing/capture.spec.ts`; it is not part of the test suite or CI.
