---
id: 028
title: Next batch legal 2FA CSP
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: feat/legal-templates
user: Shuaibali0786
command: next batch (legal pages, admin 2FA, CSP report summary)
labels: ["legal","privacy","terms","2fa","totp","csp","merge"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/data/legalContent.ts
 - frontend/src/components/legal/LegalPage.tsx
 - frontend/src/app/(site)/privacy/page.tsx
 - frontend/src/app/(site)/terms/page.tsx
 - frontend/src/lib/content.ts
 - frontend/src/types/content.ts
 - frontend/tests/unit/legal.test.ts
 - frontend/tests/unit/honesty.test.ts
 - frontend/tests/e2e/legal.spec.ts
 - frontend/tests/e2e/visual-baseline.spec.ts-snapshots/visual-baseline-{privacy,terms}-*.png
tests:
 - vitest 1491 passed
 - e2e legal, a11y, responsive, links, seo, honesty on mobile and desktop: 671 passed
 - visual-baseline 62 passed after updating the 4 privacy/terms baselines
---

## Prompt

Excellent work. Next batch, one PR per item, same merge process as before (merge only when all checks are green, smoke test after each merge, roll back and STOP if anything fails):

1. Privacy policy and terms pages: clear, honest, UK/Gulf/Pakistan friendly (PECA, PDPL, GDPR basics), marked as a template the clinic must review. Clinic name and contact come from settings. Link them in the footer. Include the uncommitted PHR files in this PR.

2. Admin two-factor login (TOTP, authenticator app) for admin accounts, optional per user, with backup codes, and all events in the Activity log. Spec-Kit first (/sp.specify, plan, tasks, analyze). If it needs a production database migration: build and test the PR, but do NOT merge. STOP and explain the exact migration steps and the risk, so I can approve.

3. CSP: summarise the CSP reports in Sentry if you can see them; if not, tell me what to check. Do NOT enforce yet.

Never print secrets. No database writes except through an approved migration.
Report as a short table and STOP.

## Response snapshot

Item 1: the Privacy and Terms pages are now built from the clinic settings (name, phone, address) by `buildPrivacyContent` and `buildTermsContent`. Each page shows a template notice and a laws-by-country section covering UK GDPR/DPA 2018/ICO, EU GDPR, UAE PDPL and the health-data law, Saudi PDPL/SDAIA, other Gulf states, and Pakistan PECA 2016 with the proposed PDP law. The demo-only facts show while `isSample` is on. The footer already linked both pages; an e2e test covers the links. The legal test still bans compliance claims everywhere and allows law names only in the laws section. Items 2 and 3 follow.

## Outcome

- ✅ Impact: legal pages are a reusable white-label template
- 🧪 Tests: see above
- 🔁 Next prompts: 2FA spec-kit (feature 011), CSP summary
