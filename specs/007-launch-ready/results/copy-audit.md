# Copy audit: prices, sales pitch, "hire us" (T047, FR-075)

Searched `frontend/src` (site pages, `src/data/`, components, `src/lib/content.ts`) for prices, sales language and calls to action. **Nothing was removed or changed.** Findings for the owner to decide.

## No sales language found
No "hire us", "get a quote", "buy now", "free trial", "book a demo", "subscribe", discount or pricing-plan copy exists on the public site.

## Prices and fees (all labelled as samples)
These are the demo clinic's own sample fees and test prices, each marked "Sample" or "sample price":
- `src/data/homeContent.ts:44,122-124` — "Browse our doctors and their fees"; "Clear consultation fees … See each doctor's fee in PKR before you book."
- `src/data/faq.ts:85-98` — FAQ "Are the prices real?" (answer: no, invented samples) and "How do health package prices work?"
- `src/data/aboutContent.ts:62` — "see schedules, preparation and sample prices"
- `src/components/booking/BookingFlow.tsx:443-444`, `ConfirmationCard.tsx:86-87` — "Fee … (sample)"
- `src/components/home/DoctorCard.tsx:53`, `booking/DoctorStep.tsx:21` — "Consultation fee" with the PKR amount
- `src/components/lab-tests/LabTestCard.tsx:43`, `LabTestFacts.tsx:17-20` — price with a "Sample price" badge
- `src/components/departments/DepartmentSections.tsx:86,97` — "Fees and schedules are invented for the demo"; "All prices are sample prices"

**Question for the owner:** keep these (they are the demo clinic's labelled content) or hide them?

## Portfolio and maker wording (not sales, but worth a look)
- `src/components/layout/AnnouncementBar.tsx:15` — "Portfolio demo — see how the clinic team runs everything" (links to the demo dashboard)
- `src/components/layout/SiteFooter.tsx:34`, `src/data/legalContent.ts`, `src/data/aboutContent.ts`, `src/app/(site)/book-appointment/page.tsx:31`, `src/app/(site)/layout.tsx:36` — "This is a portfolio demo and not a real clinic"
- `src/components/brand/PoweredBy.tsx:11` — "Powered by Shuaib Health", and the footer credit "Designed & built by Shuaib Ali" (a credit line, not an offer)

**Question for the owner:** is the "Designed & built by …" credit acceptable, or should it go?

## Owner decisions (2026-10-10)
- **Sample prices and fees:** keep them. They are the demo clinic's content and stay labelled "Sample".
- **"Designed & built by Shuaib Ali" credit:** keep it.
No copy changes follow from this audit.
