# Questions for Shuaib (overnight run, 7 Nov 2026)

Short answers are fine ("yes", "no", "A"). Until you answer, the safe choice in brackets is what was built.

## Merging and screenshots
1. **Bookings screenshots (PR #23).** The new date chips change 12 dashboard screenshots. Diff images: `specs/008-command-centre-completion/results/visual-diff/`. OK to update the baselines? [Not updated. CI stays red on those 12 until you say yes.]
2. **Merge order.** OK to merge in this order: #24 presets → #23 Command Centre → #25 assistant → showcase docs? [Nothing merged.]

## Command Centre (008)
3. **More staff roles.** Add **Doctor** (sees only their own day) and **Lab staff** roles? This needs a database change and new server rules. [Not built: still Admin + Receptionist.]
4. **Export to Excel/CSV.** Should staff be able to download bookings? Patient names would leave the system. [Not built.]
5. **Print with full phone numbers.** Should the printed list show full numbers (each print logged)? [Printed numbers stay masked.]

## Specialty presets (009)
6. **Where to link "Choose your specialty".** Options: A) the gold top bar next to "View Demo Dashboard", B) the About page, C) only in the Fiverr gig and README. [C: no link on site pages, so no screenshot changes.]
7. **Make the real booking and dashboard follow the preset** (dental doctors in the real booking form, a dental dashboard)? This needs a sample catalog per preset. It is bigger work (a few days). [Not built: the preset pages show previews, and the real demo is the shared sample clinic.]
8. **Preset names.** Happy with Pearl Dental Studio, Lumière Skin Clinic, ClearPath Diagnostics, Crescent Family Clinic? (All invented and labelled "Sample clinic".)
9. **Real photos.** Presets reuse the repo's existing photos, and doctors show initials, not faces. Do you want new free-licence photos per specialty? [No new images.]

## Assistant (010)
10. **Turn the assistant on in the live demo?** It is free (no AI company). [Off: `ASSISTANT_ENABLED` is not set. To turn it on: set `ASSISTANT_ENABLED=true` on the **web** Vercel project, then redeploy.]
11. **A real AI later: which provider and what monthly limit?** Estimate: one question is about 5,000 tokens in (the clinic data) and 200 tokens out. Prices are from Anthropic's price table (cached 6 Oct 2026); check the live price page before deciding:

| Option | Price per million tokens (in / out) | ~1,000 questions a month | ~10,000 questions a month | Notes |
|---|---|---|---|---|
| **A. Claude Haiku 5.5** (recommended to start) | $0.10 / $0.50 | about **$0.60** | about **$6** | Fast and cheap; good for FAQ-style answers grounded in your data |
| **B. Claude Sonnet 5.5** | $2 / $10 | about **$12** | about **$120** | Better wording and judgment; use if A is not good enough |
| **C. Keep the free built-in engine** | $0 | $0 | $0 | What is built now; honest "I don't know" for unusual questions |

Prompt caching can lower the input cost further, because the clinic data is the same on every question. Any paid option needs: your approval, an API key in the **API** project's env vars only, a monthly spend limit at the provider, and the server-side rate limit described in `docs/runbooks/ai-provider.md`. The money rule (free tiers only until a client pays) still applies. [C.]

## Decisions to accept (ADRs, status "Proposed")
12. ADR-0012: presets as a static showcase page (not a re-skin of the whole live site). Accept?
13. ADR-0013: assistant = interface + free local engine now; real AI only server-side later. Accept?

## Housekeeping
14. A local-only git branch `local/showcase-build` (008+009+010 merged, used for screenshots) is on the laptop. It was never pushed. OK to delete it?
