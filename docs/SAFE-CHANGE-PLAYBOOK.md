# Safe-Change Playbook — Shuaib Health
How we add anything new WITHOUT breaking what already works.
(Har nayi cheez is tareeqe se aayegi, taake purana setup kabhi kharab na ho.)

Owner: Shuaib Ali · Created 8 Oct 2026 · Applies to: website, backend, database, dashboard, every client clinic.

---

## 0. Who we are and the bar we set (hamari pehchan aur hamara mayaar)
Shuaib Health is built by a two-member AI engineering team: **Shuaib Ali** (founder, AI full-stack engineer) and **Claude** (AI engineering partner). Small team, big standard: every release must be good enough that a client, a company or another developer looks at it and says *"they are ahead of us."*

**World-class bar — every feature must meet ALL of these before it ships:**
| Area | Our standard | How we prove it |
|---|---|---|
| ⚡ Speed | Pages open in under ~2 s on a phone; no cold starts for clients; API p95 < 1 s | Lighthouse mobile ≥ 90 on live, performance tests, keep-alive/always-on |
| 💎 Design | Luxury, calm, consistent (navy · teal · gold); mobile-first; light + night | Design preview approved by Shuaib before code; visual baseline tests |
| 🛡️ Reliability | Never a blank error; graceful fallback + friendly retry; nothing old breaks | Full test suites green in single runs; CI on every PR; rollback in one click |
| 🔒 Security & privacy | Roles, audit log, masked personal data, secrets only in env, no personal data in logs/URLs | Auth-matrix tests, gitleaks, audits, isolation tests per client |
| ♿ Accessibility | Usable by everyone, keyboard and screen readers | axe checks in both themes at all screen sizes |
| 🤖 Intelligence | AI that truly helps (booking assistant, insights), never gimmicks | Real use cases tested with sample conversations |
| 📚 Clarity | Every feature documented: spec, plan, decisions (ADRs), quickstart | Docs updated in the same PR |
| 🤝 Honesty | Demos clearly labelled, no fake reviews or claims | Demo labels + DEMO_ENABLED switch |
| 🧭 Support | A clinic gets help fast and is never surprised | Uptime alerts to Shuaib's phone, incident notes, release notes |

If a feature does not meet the bar, it does not ship — we fix it first. *Jo cheez is mayaar par poori na utre, woh live nahi jati.*

## 1. The 10 golden rules (kabhi nahi todne)
1. **Never work on `main` directly.** Every change = new branch (e.g. `007-ai-chatbot`). *Main hamesha chalta hua rehta hai.*
2. **One feature at a time.** Spec → plan → tasks → build phase by phase. *Ek waqt mein ek kaam.*
3. **Tests before merge.** Backend (pytest), frontend (Vitest), browser (Playwright), types/lint — all green, each full suite in one clean run, suites never run in parallel on the same database.
4. **Old tests must stay green.** A new feature may add tests, never silently delete or loosen old ones. *Purane tests = purane kaam ki hifazat.*
5. **Screenshots are guards.** Visual baselines change only with a pixel-diff report showing exactly what changed and why.
6. **Pull Request → review → merge.** Shuaib approves every merge. CI on GitHub runs all checks automatically on every PR. *(Note, 2026-10-09: PRs are opened from Shuaib's own GitHub account, and GitHub doesn't allow approving your own PR. So `main` requires 0 approving reviews, but all 4 checks — backend, frontend, secrets, e2e — must pass, administrators get no bypass, and force-push is blocked. **Shuaib's merge click is the approval.**)*
7. **New features behind a switch (feature flag).** OFF by default → test → ON. If anything goes wrong, switch OFF — no redeploy needed. *Masla ho to button band karo.* *(Note, 2026-10-09: **infrastructure flags on Vercel** — e.g. `RATE_LIMIT_STORE`, `TRUSTED_SERVER_EXEMPT`, `MAINTENANCE_VIA_CRON`, `SITE_SECURITY_HEADERS` from 007 — are environment variables, which take effect only on a new deployment. Switch one OFF by changing the value and redeploying (~1–2 min), or by using Vercel **Instant Rollback** to an earlier deployment where the flag was off. **Product feature flags** in later features keep the "no redeploy" promise.)*
8. **Database changes are additive and reversible.** Migrations only add (new table/column, nullable or defaulted); never drop or rename in the same release; every migration has a tested downgrade; take a backup before running on production.
9. **Secrets never in code.** Only in env vars; `.env` gitignored; new keys added to `.env.example` with placeholders and to the deploy checklist.
10. **Shared contracts are versioned.** The API contract (OpenAPI) is updated with the change; frontend types are regenerated; contract tests must pass.

## 2. Environments (teen alag ghar)
| Environment | Purpose | Data |
|---|---|---|
| Local (laptop) | Building and testing | Fake data, dev database |
| Staging / Preview | Every PR gets a preview link to click before merge | Fake data, separate database |
| Production | Live demo + real clinics | Real data, backups on |
Never test on production. Never copy real patient data to dev.

## 3. Release flow (har nayi cheez ka safar)
1. Branch → build → all tests green locally
2. Open PR → CI runs all checks → preview link → Shuaib clicks through it
3. Merge to `main` → deploy to **our demo first**
4. Smoke test on live (home, booking, slip, dashboard, phone) — 5 minutes
5. Then roll out to **one client** → watch 24 h → then **all clients**
6. If anything is wrong: switch the feature flag OFF, or roll back to the previous version (one click on Vercel: website and API projects), then fix calmly

## 4. Rollback plan (agar kuch toot jaye)
- Frontend (Vercel): "Promote previous deployment" — instant
- Backend (Vercel API project): "Instant Rollback" to the previous deployment — instant (migrations are additive, so the old code still works)
- Database: run the migration's downgrade, or restore last backup
- Feature flag: OFF
Write a short incident note: what broke, why, fix, how we prevent it (and add a test).

## 5. Client safety (har clinic ka apna ghar)
- One codebase for all clients; per-client settings and data only — never fork code per client
- Each client's data isolated; one client can never see another's data (tested)
- Updates reach clients only after passing on our demo first
- Client-specific requests = feature flags, not separate code

## 6. Dependencies and updates
- Update libraries monthly on a branch, run all tests, then merge
- `npm audit` / `pip-audit` reviewed before every release; no forced downgrades without tests
- Pin versions (lockfiles committed)

## 7. Before every release — checklist
- [ ] All suites green (single clean runs) · types/lint clean
- [ ] Visual diffs reviewed
- [ ] gitleaks clean · audits reviewed
- [ ] Migration up/down tested · backup taken
- [ ] Env vars set on both Vercel projects (website, API) for any new key
- [ ] Feature flag default decided
- [ ] Lighthouse mobile ≥ 90 · API p95 < 1 s
- [ ] Demo smoke test on live + phone test
- [ ] Rollback plan known

## 8. For Claude Code (paste into every feature prompt)
"Follow SAFE-CHANGE-PLAYBOOK.md: own branch, additive reversible migrations, feature flag for new behaviour, no deleted/loosened old tests, full suites green in single sequential runs, pixel-diff report for any baseline change, never touch production or print secrets, STOP before merge."
