# Feature Specification: Launch Ready — First Live, Monitored, Safe Public Demo

**Feature Branch**: `007-launch-ready`
**Created**: 2026-10-09
**Status**: Draft
**Input**: User description: "007-launch-ready: take Shuaib Health from laptop to a live, monitored, safe public demo — the first real deployment. Follow docs/SAFE-CHANGE-PLAYBOOK.md and the constitution. Input: read D:\shuaib-health-reports\deploy-readiness-2026-10-09.md — all 5 blockers and 8 important findings must be covered; nice-to-haves listed as optional. Scope: Hosting: Vercel (frontend, region sin1) + Render (FastAPI, Singapore) + Neon (Postgres, Singapore) — same region. FREE tiers only (founder money rule); note any free-tier limit that could bite (Vercel Hobby terms, Render sleep, Neon compute hours/autosuspend) and how we stay inside it. Deploy config in repo (render.yaml, vercel config if needed), Alembic migrations run safely on deploy, one-off first seed + first admin via CLI, never on our dev DB by mistake. Production defaults: DEMO_ENABLED on for our public demo, indexable off, SITE_URL correct, no localhost anywhere. Rate limiting + real client IP correct behind Vercel/Render proxies. CI: GitHub Actions on every PR (lint, types, unit tests, build; e2e as budget allows), required before merge. Monitoring: UptimeRobot alerts to owner, keep-alive within free limits, error tracking (free tier), health/ready endpoints. Backups + a tested restore drill. Security: fix the 6 high npm audit findings, secrets only in host dashboards, gitleaks, security headers. Speed promise: Lighthouse mobile ≥ 90 on live, API p95 < 1s, phone QA on a real device, smoke test checklist, one-click rollback documented. Runbook docs: deploy, rollback, incident note, new-env-var checklist. Out of scope: real clinic clients, paid plans, custom domain purchase (prepare for it only), new product features. Stop after the spec is written and show me a short summary + any open questions. Do not write code, do not create accounts, do not deploy."

## Context

Features 001–006 built the public website, catalog, online booking and the Clinic Command Centre (staff dashboard + one-click public demo). Everything runs only on the founder's laptop. Nobody outside can see it, and nothing tells us when it breaks.

This feature is **Phase 4 (Deploy)** of the constitution's build order. It turns the existing product into a **live public demo** that a prospective clinic owner can open on their phone, that the founder is alerted about when it fails, that can be rolled back in one click, and whose data can be restored. It adds **no new product features**.

The deploy-readiness audit of 2026-10-09 (`D:\shuaib-health-reports\deploy-readiness-2026-10-09.md`, "the audit") found the application design deploy-friendly (backend-for-frontend, secret-protected server-to-server calls, solid CSRF and cookie design) but the **deployment layer** missing: 5 blockers (B1–B5), 8 important findings (I1–I8) and 6 nice-to-haves (N1–N6). Every blocker and important finding is covered below; nice-to-haves are optional (see Traceability).

**Fixed decisions from the owner (not up for re-litigation in plan):**
- Hosts: website on Vercel (server functions in Singapore, `sin1`); database on Neon (Singapore, `aws-ap-southeast-1`). The API host was originally Render (Singapore); because the owner's Render account is already fully used by another service (see Clarifications and FR-074), the **API host is chosen in the plan** among Render, Vercel Python functions and other genuinely free options near Singapore, and recorded in an ADR. Everything stays in or near one region.
- Free tiers only. No paid plan, no paid add-on, no custom domain purchase.
- The live deployment is **our public demo**: demo mode ON, search-engine indexing OFF.
- The live site is a **non-commercial portfolio demo**: no prices, no sales pitch, no "hire us" / contact-to-buy call to action. The website moves to Vercel Pro before the first paying client (money rule).

## Clarifications

### Session 2026-10-09

- Q: Where do encrypted daily backups live? → A: The owner's Google Drive, encrypted before upload, 14 days retained. If automating the Drive upload adds too much risk or complexity for the free phase, the plan proposes the simplest safe alternative (FR-056).
- Q: Does Vercel Hobby's non-commercial rule fit? → A: Yes — the live site is treated as a non-commercial portfolio demo (no prices, no sales pitch, no "hire us" button). Move to Vercel Pro before the first paying client (FR-075).
- Q (analysis K2): Constitution XI flags? → A: Flags OFF in code, switched ON explicitly in production; endpoints with secrets stay off when the secret is unset (FR-079).
- Q (analysis H2): Merge approval with a single-account owner? → A: 0 required approvals; 4 required checks; no force-push; no admin bypass; the owner's merge click is the approval (FR-042).
- Q (analysis H7): Limiter behaviour on a DB failure? → A: Only the general per-IP check lets requests through; booking, login, lookup and demo limits keep blocking (FR-034).
- New constraint (owner): the owner's Render account already runs `kbg-backend` (a burger-restaurant site), kept awake 24/7 by UptimeRobot (~744 h/month). Two always-on services cannot both fit in Render's 750 free hours. The clinic API must keep the speed promise **and** cost $0 **without** degrading the burger site (FR-074).

## User Scenarios & Testing *(mandatory)*

Actors:
- **Visitor** — a prospective clinic owner, developer or recruiter opening the public demo, usually on a phone.
- **Owner** — Shuaib, who deploys, gets alerts, rolls back and restores.
- **Contributor** — anyone (Shuaib or Claude) opening a pull request.

### User Story 1 — A visitor opens the live demo and everything works (Priority: P1)

A visitor opens the public URL on their phone. The home page loads fast, shows real catalog data from the live API (not the static fallback), booking works end to end and returns a booking reference and slip, and "View Demo Dashboard" opens the Command Centre demo with no password. Nothing anywhere points to `localhost`. The site asks search engines not to index it.

**Why this priority**: This is the whole point of the feature — without a working live URL, nothing else matters. It covers blockers B1, B2, B4, B5 and I1.

**Independent Test**: Deploy all three tiers, then run the live smoke-test checklist (FR-060) from a real phone on mobile data.

**Acceptance Scenarios**:

1. **Given** the production deployment is live and warm, **When** a visitor opens the home page on a mid-range phone, **Then** it renders with live catalog data and the Lighthouse mobile score for that page is ≥ 90.
2. **Given** the live site, **When** a visitor completes a booking, **Then** they get a booking reference and a printable slip, and the booking is visible in the demo-safe data flow defined by Feature 005/006.
3. **Given** the live site, **When** the visitor taps "View Demo Dashboard", **Then** the Command Centre demo opens without a password and shows the "Demo mode — changes are not saved" ribbon.
4. **Given** the live site, **When** anyone fetches the page source, canonical links, Open Graph tags, sitemap or robots file, **Then** none contains `localhost` or an `http://` self-link, and the robots file disallows all crawling while the clinic's `indexable` switch is off.
5. **Given** the API has never been reachable since the website was built, **When** a visitor opens any page, **Then** they see the friendly fallback/empty state, never a blank error (Constitution V).

---

### User Story 2 — Every pull request is checked automatically before it can merge (Priority: P1)

A contributor opens a pull request. Automated checks run lint, type-checks, unit tests, the website build (including a build with the API unreachable) and a secret scan. The merge button stays blocked until all required checks pass and the owner approves.

**Why this priority**: The playbook and constitution already promise "CI on every PR"; today it is manual. Without it, the first live deploy can be broken by the next merge. Covers B1 (CI half).

**Independent Test**: Open a throwaway PR that introduces a deliberate lint error and a fake secret-shaped string; confirm both checks fail and merge is blocked; fix them and confirm merge unblocks only after owner approval.

**Acceptance Scenarios**:

1. **Given** a PR that breaks a unit test, **When** checks run, **Then** the PR shows a failed required check and cannot be merged.
2. **Given** a PR that adds a string matching a secret pattern, **When** checks run, **Then** the secret-scan check fails and names the file and line (without printing the secret value).
3. **Given** a PR with any required check failing or pending, **When** anyone tries to merge (including the owner as administrator), **Then** the merge is blocked. With all checks green, only the owner's merge click merges it.
4. **Given** CI tests need a database, **When** they run, **Then** they use a disposable test database that is never the dev or production database.

---

### User Story 3 — The owner is alerted when the live demo breaks, and can see why (Priority: P1)

If the website or API goes down, or a server error happens, the owner gets an alert on their phone within minutes. Errors are captured with enough context to debug, but with no personal data.

**Why this priority**: A live demo that silently breaks in front of a prospect is worse than no demo. Covers I5 and the playbook's "uptime alerts to Shuaib's phone".

**Independent Test**: Pause the API service; confirm an alert reaches the owner's phone within 10 minutes and a recovery notice follows after resuming. Trigger a deliberate test error; confirm it appears in error tracking with personal fields scrubbed.

**Acceptance Scenarios**:

1. **Given** the API stops responding, **When** two consecutive uptime checks fail, **Then** the owner receives a phone notification and an email.
2. **Given** the website home or a catalog page returns an error, **When** the check fails, **Then** the owner is alerted separately from API alerts (so the broken tier is obvious).
3. **Given** an unhandled server error during a booking, **When** it is captured, **Then** the error record contains the request ID and route but no patient name, phone, email, booking reference, cookie, or secret.
4. **Given** a deploy fails on either host, **When** the host reports the failure, **Then** the owner is notified.

---

### User Story 4 — Fair rate limiting: one noisy visitor cannot lock everyone out (Priority: P1)

Rate limits apply per real visitor. The website's own server-side page fetches (including bursts when pages regenerate) are never counted as one shared "visitor" and never get rate-limited into showing fallback data.

**Why this priority**: Blocker B3 — today all catalog traffic from the website shares one 60/min bucket behind Render's proxy, so a normal page-regeneration burst could serve stale fallback data to everyone.

**Independent Test**: From the deployed website, trigger more than 60 catalog fetches within a minute; confirm none returns "too many requests". From one external address, exceed the public limit; confirm only that address is limited.

**Acceptance Scenarios**:

1. **Given** the website's server makes its 61st catalog request in a minute with a valid server secret, **When** the API evaluates it, **Then** it is not rejected as rate-limited.
2. **Given** two different visitors book from different networks, **When** one exceeds the booking limit, **Then** the other is unaffected.
3. **Given** a request arrives with a forged forwarded-for header and no valid server secret, **When** the API derives the client address, **Then** the forged value is not trusted beyond the measured number of proxy hops.

---

### User Story 5 — Safe database changes: migrate, seed, back up, restore (Priority: P2)

The production database schema is brought up to date automatically and safely on every deploy. The first catalog seed and first admin account are created once, deliberately, from the owner's laptop — never against the dev database by mistake. Backups exist off the hosting platform, and the owner has actually restored one.

**Why this priority**: Covers B2, I4, I6 and playbook rule 8. P2 only because the first deploy can technically happen before the first restore drill — but launch is not "done" until the drill passes.

**Independent Test**: Run the documented restore drill: take a backup, restore it into a scratch database, verify row counts and a known booking match, record the time taken.

**Acceptance Scenarios**:

1. **Given** a deploy contains a new migration, **When** the API starts, **Then** the schema is upgraded before it serves traffic; if the upgrade fails, the new version does not serve traffic and the previous version keeps running (or the service reports not-ready).
2. **Given** the schema is already current, **When** the API restarts or wakes from sleep, **Then** re-running the upgrade is a harmless no-op.
3. **Given** the owner runs the one-off seed or create-admin command, **When** the target is the dev database or any target not explicitly confirmed as production, **Then** the command refuses and changes nothing.
4. **Given** the owner runs the one-off command against production, **When** it starts, **Then** it shows a non-secret identifier of the target (e.g. masked host and database name) and requires explicit confirmation before writing.
5. **Given** a scheduled backup has run, **When** the owner follows the restore drill, **Then** a scratch copy is restored and verified within 30 minutes, and the drill result is recorded in the runbook.
6. **Given** a PR adds a migration, **When** it is reviewed, **Then** the deploy checklist requires a named restore point to be taken before merge-to-deploy.

---

### User Story 6 — One-click rollback and clear runbooks (Priority: P2)

When a release goes wrong, the owner follows a short written runbook: roll back the website in one click, the API to the previous version, and — if needed — the database. Afterwards they write a short incident note. Adding a new environment variable follows a checklist so no host is forgotten.

**Why this priority**: Playbook §4 promises rollback; it has never been documented for real hosts. Covers I6, I7, I8 documentation needs.

**Independent Test**: On the live demo, roll the website back to the previous deployment and forward again, and roll the API back to the previous version, following only the runbook; time both.

**Acceptance Scenarios**:

1. **Given** a bad website release, **When** the owner follows the rollback runbook, **Then** the previous website version is live within 2 minutes.
2. **Given** a bad API release, **When** the owner follows the rollback runbook, **Then** the previous API version is live within 10 minutes.
3. **Given** a new environment variable is introduced in a PR, **When** the PR is reviewed, **Then** the checklist shows it added to the example env file, the deploy config (name only), and each host's dashboard for each environment.

---

### User Story 7 — Free-tier fit: the demo stays up without spending money (Priority: P2)

The demo stays reachable and reasonably warm all month without exceeding any free allowance, and the owner knows exactly which limit would bite first and how to see it coming.

**Why this priority**: Founder money rule; covers I2, I3, I7.

**Independent Test**: After 7 days live, read each host's usage page and project to month-end; each projected figure is ≤ 80% of its free allowance.

**Acceptance Scenarios**:

1. **Given** keep-alive is running, **When** usage is projected to month-end, **Then** API instance hours, database compute hours, website bandwidth/function usage and CI usage are each ≤ 80% of their free allowance.
2. **Given** the API has slept, **When** a visitor arrives, **Then** they see a friendly loading/retry state rather than a raw error, and the booking flow still succeeds once the API wakes.
3. **Given** the database has suspended, **When** the API wakes it, **Then** the first request still succeeds within the website's timeout or shows the friendly retry.

---

### Edge Cases

- **API asleep at website build time** → build succeeds with fallback data (Constitution V); pages refresh to live data on next regeneration.
- **Database suspended when the API starts and runs its migration step** → the step waits for the database to wake (within a bounded time) rather than failing the deploy on the first attempt.
- **Migration fails halfway** → the migration is transactional where the database allows; the new version does not take traffic; the runbook says how to restore the named restore point.
- **Required production setting missing** (e.g. demo switch, site URL, secrets) → the app refuses to start / the build fails with a message naming the missing setting, never silently falling back to a demo or `localhost` default.
- **Website and API demo switches disagree** → detected by the smoke test; the runbook says both must be changed together and the website redeployed.
- **Preview deployments** (per-PR website previews) → use their own demo-only database and secrets (FR-005), are noindex, pass deployment protection through a preview-only bypass, and staff sign-in is verified on the preview URL (audit E1).
- **Free allowance about to run out mid-month** → owner gets a usage warning from the host where available; runbook says what to switch off first (keep-alive of the database before the API).
- **Monitor itself is down** → acceptable; host failure notifications are a second channel.
- **Error tracker quota exhausted** → app keeps working; errors still reach the host logs.
- **Someone opens `/admin/...` from an email link** → sign-in page once (strict cookie), documented as expected (audit Q&A 2 / N2).
- **Backup job fails** → the owner is notified; a missed backup is visible.
- **Secret accidentally committed** → CI blocks the PR; runbook says rotate the secret on every host, not just delete the commit.

## Requirements *(mandatory)*

### Functional Requirements

#### A. Hosting and deploy configuration (B1, I1, N4, N5)

- **FR-001**: The repository MUST contain declarative deploy configuration for the API host (service, Singapore region, build and start commands, health-check path, runtime version pin, list of required setting *names* with secret values marked as set-in-dashboard-only) and, where needed, for the website host (server-function region Singapore, runtime version pin).
- **FR-002**: Website server functions, the API and the database MUST all run in the Singapore region; the plan MUST record how each was verified.
- **FR-003**: Deploy configuration MUST NOT contain any secret value, connection string or real credential.
- **FR-004**: *(N/A after ADR-0011: the API runs as Vercel Python Functions, which call the ASGI app directly, with no start command or port binding.)* The API MUST NOT emit a duplicate per-request access log; the app already logs a structured line.
- **FR-005**: Website preview deployments MUST NOT be able to reach the production database or use production secrets. The preview database MUST hold **demo data only**: it is created empty and seeded with demo data, never copied from production (playbook §2). It MUST be migrated by preview builds. Preview website→API server calls MUST pass the host's deployment protection using a preview-only bypass credential, so previews can be clicked through end to end.

#### B. Database migrations, first seed, first admin (B2, I6)

- **FR-010**: Every API deploy MUST apply pending schema migrations, using the database's direct (non-pooled) connection, before the new version serves traffic.
- **FR-011**: The migration step MUST be safe to re-run (no-op when current) and MUST stop the new version from serving traffic if it fails.
- **FR-012**: The readiness endpoint MUST report not-ready until the schema is at the latest migration.
- **FR-013**: The first catalog seed and first admin account MUST be created by one-off, owner-run commands from the owner's machine against production, documented step by step in the deploy runbook. The seed's existing refusal to run in production by default MUST NOT be weakened; any production path MUST be explicit and deliberate.
- **FR-014**: Those one-off commands MUST display a non-secret identifier of the target database and require explicit confirmation, and MUST refuse when the target matches the dev database.
- **FR-015**: The first admin's password MUST be entered interactively (never in a file, argument history, or log), and the command MUST print a clear success line that contains no secret.
- **FR-016**: Development and production MUST use separate databases with separate credentials (Constitution VII).

#### C. Production defaults fail closed (B4, B5)

- **FR-020**: When running as production, the API and website MUST require the demo switches to be set explicitly; a missing value MUST be a startup/build error. For our deployment both are set ON.
- **FR-021**: When running as production, the website MUST require a correct public https site URL (or derive it from the host's production URL); if neither is available, the build MUST fail. No `localhost` or `http://` self-URL may appear in canonicals, Open Graph tags, sitemap or robots output.
- **FR-022**: The production clinic record MUST have `indexable` OFF at launch; the robots file MUST disallow all crawling and pages MUST carry noindex while it is off. Turning it on is out of scope.
- **FR-023**: The deploy checklist MUST record the chosen value of each switch per deployment, and the smoke test MUST verify the website and API agree on the demo switch.
- **FR-024**: A prepared, documented path for a future custom domain MUST exist (which settings change, which origin allow-lists change, which checks re-run), without buying or connecting one.

#### D. Rate limiting and real client IP (B3, I8, N1)

- **FR-030**: The website's own server-side requests to the API (including public catalog fetches and page-regeneration bursts) MUST NOT share a single rate-limit bucket; trusted website requests MUST be identified by the existing server secret and limited per real visitor where a visitor exists.
- **FR-031**: The number of trusted proxy hops in front of the API MUST be set from a **measured** forwarded-for header on the live host, recorded in the runbook, not guessed.
- **FR-032**: The website MUST derive the visitor's IP from the hosting platform's own trusted header in preference to the first forwarded-for entry. *(Optional — N1; included because it is small and protects against host changes.)*
- **FR-033**: Automated tests MUST prove: a 61st website-origin catalog request in one minute is not rate-limited; a forged forwarded-for header without the server secret is not trusted; two visitors are limited independently.
- **FR-034**: In production, every rate limit and lockout MUST use state shared across instances (Postgres), never process memory (I8, condition C2). On a database failure, **only** the general per-IP check lets requests through (logged by error class). Booking, login, lookup and demo-start limits keep blocking, as today (owner decision, 2026-10-09).

#### E. Continuous integration (B1)

- **FR-040**: Every pull request to `main` MUST automatically run: backend lint, backend type-check, backend unit/integration tests (against a disposable test database), website lint, website type-check, website unit tests, website production build, website build with the API unreachable, and a secret scan of the change.
- **FR-041**: Browser end-to-end tests MUST run in CI as a **required** check on every PR (Constitution IX). A flaky or slow test is fixed. It is quarantined only with the owner's written approval, and the check itself is never made optional.
- **FR-042**: `main` MUST be protected: the four required checks (backend, frontend, secrets, e2e) must pass; branches must be up to date; force-pushes and deletion are blocked; there is no administrator bypass. Required approving reviews = **0**, because PRs are opened from the owner's own account and GitHub forbids self-approval. **The owner's merge click is the approval** (playbook rule 6, owner decision 2026-10-09).
- **FR-043**: CI MUST NOT have access to production secrets or the production database, and MUST NOT print secret values.
- **FR-044**: Database migrations MUST be applied up and down on a scratch database in CI (Constitution VII).
- **FR-045**: Dependency audits (website and API) MUST run in CI; high-severity findings MUST fail the check unless listed in a reviewed, dated allow-list with a reason.

#### F. Monitoring, alerts, keep-alive, error tracking (I2, I3, I5)

- **FR-050**: Uptime monitors MUST check: the API liveness endpoint, the website home page, and one catalog page (proving the full website→API path). Failures MUST alert the owner by phone notification and email; recovery MUST also notify.
- **FR-051**: Monitors MUST check the database-free liveness endpoint every 5 minutes. Every check that touches the database (the readiness endpoint, a catalog page) MUST run **at most hourly**, so the database can sleep within its free compute budget. No separate keep-alive service is used: the API host doesn't sleep (ADR-0011).
- **FR-052**: Server errors on both website and API MUST be captured in a free-tier error-tracking service with: environment, release/version, route, request ID. Personal data (names, phones, emails, booking references, cookies, auth headers, secrets, query strings with personal data) MUST be scrubbed before sending.
- **FR-053**: Host deploy-failure notifications MUST be enabled for the owner on both website and API hosts.
- **FR-054**: The liveness endpoint MUST stay database-free, rate-limit-exempt and uncached; the readiness endpoint MUST check database and migration head.

#### G. Backups and restore (I4)

- **FR-055**: The database host's built-in point-in-time history MUST be set to the maximum the free plan allows.
- **FR-056**: A scheduled, automated logical backup MUST run at least daily and be stored **off the database host** — in the owner's Google Drive by default — encrypted **before** upload, with **14 days** of copies retained and older copies removed. Backup files MUST NOT be publicly readable (the repository is public), and the encryption key MUST NOT be stored next to the backups. If automated Drive upload is judged too risky or complex for the free phase, the plan MUST propose the simplest safe alternative that keeps these properties.
- **FR-057**: A named restore point MUST be taken before any production deploy that contains a migration (playbook rule 8); the deploy checklist enforces this.
- **FR-058**: The owner MUST complete and record one restore drill (restore into a scratch database, verify row counts and one known record, record duration) before the feature is declared done.
- **FR-059**: A failed scheduled backup MUST notify the owner.

#### H. Security (N3, N6)

- **FR-061**: All 6 high-severity findings in the website dependency audit (as of 2026-10-09: `braces`/`micromatch`/`fast-glob` chain via the lint config, and `source-map-js`) MUST be resolved **without** a forced downgrade of any direct dependency (playbook §6). If a finding has no non-forced fix, it MUST be documented in the audit allow-list with reason and review date, and the owner MUST approve.
- **FR-062**: An API dependency audit MUST be added and its high findings resolved or allow-listed the same way.
- **FR-063**: Secrets MUST exist only in host dashboards (and local, git-ignored env files); every required setting MUST be listed by name in the example env files and deploy checklist.
- **FR-064**: The secret scanner MUST run over the full repository history once before launch, and on every PR thereafter.
- **FR-065**: The public website MUST send baseline security headers on every page (HSTS, no-sniff, referrer policy, frame-embedding denial, permissions policy, and a content security policy that does not break existing pages or Lighthouse scores). Existing stricter headers on admin routes MUST be kept.
- **FR-066**: The API's machine-readable route listing SHOULD be disabled in production alongside the already-hidden docs page. *(Optional — N3; included because it is a one-line hardening.)*

#### I. Speed promise and launch QA

- **FR-060**: A written **live smoke-test checklist** MUST exist and be run after every production deploy, covering: home, a catalog page, booking end to end with slip, demo dashboard open, admin sign-in page, robots/noindex, no-localhost check, demo-switch agreement, security headers present, liveness and readiness endpoints.
- **FR-067**: Lighthouse mobile **Performance, Accessibility and Best Practices** MUST each be ≥ 90 on the live home page and one catalog page, warm, with results saved in the feature folder. **SEO** MUST be ≥ 90 on a **test-only build with `indexable=true`**; the seed and live data stay unchanged. On the live noindex demo, a lower SEO score caused only by the "page is blocked from indexing" audit is expected and recorded, not a failure.
- **FR-068**: API response time p95 MUST be < 1 s for catalog and booking endpoints on the live deployment with warm services, measured from the website's region, with the method and results saved.
- **FR-069**: A real-device phone QA pass (at least one Android device on mobile data; iPhone if available) MUST cover the smoke-test checklist and be recorded with screenshots.
- **FR-070**: Cold-start behaviour MUST be measured once (API asleep + database suspended) and documented, with the visitor-facing experience confirmed as the friendly retry, not a blank error.

#### J. Runbooks and docs

- **FR-071**: The repository MUST contain runbooks for: first deploy (accounts→config→secrets→migrate→seed→admin→verify), routine deploy, rollback (website, API, database, feature flag), incident note template, new-environment-variable checklist, restore drill, free-tier usage check, and secret rotation.
- **FR-072**: The playbook's pre-release checklist and PR template MUST reference these runbooks; the `.env.example` files MUST match the final list of required settings.
- **FR-073**: A plan-fit note MUST list each free-tier limit, today's projected usage, and what must change (and roughly what it costs) before the first paying clinic (I7). No paid plan is purchased in this feature.

#### K. Coexistence with existing services and terms

- **FR-074**: The clinic API MUST meet the speed promise (FR-068, SC-003, no visitor-facing cold start beyond the friendly-retry path) at $0, and MUST NOT change the uptime, keep-alive, free-hour consumption, configuration or deploys of the owner's existing `kbg-backend` service. The chosen API host, and evidence that both services fit their free allowances for a full month, MUST be recorded in the plan and an ADR.
- **FR-076** (C1): The API MUST connect at runtime through the database's **pooled** URL with a serverless-safe pool (default 1 connection + 1 overflow, 5 s pool timeout, pre-ping). Production MUST refuse a non-pooled runtime URL.
- **FR-077** (C3): API functions MUST NOT start background threads or tasks that outlive a request. Recurring maintenance (demo purge, session cleanup, expired counters) MUST run through the host's daily cron calling an authenticated endpoint. Error reporting MUST finish sending before the response returns.
- **FR-078** (C4): Cold-start latency of the API MUST be measured on a **preview** deployment (function cold and database suspended), and recorded against the speed promise **before** the first production deploy. A failed target blocks production.
- **FR-079** (Constitution XI): Each new behaviour in this feature MUST sit behind a flag that is **OFF in code** and switched **ON explicitly** in production. In production a missing flag value is a startup or build error. The flags:
  - shared per-IP limiter store;
  - trusted-server exemption;
  - cron-based maintenance (replaces the startup purge);
  - site-wide security headers (`off` / `report` / `enforce`).
  The maintenance and error-check endpoints additionally stay off whenever their secret is unset.
- **FR-075**: The live site MUST NOT show prices, a sales pitch, or any "hire us" / buy / contact-sales call to action while on Vercel Hobby. The launch checklist MUST include this check, and the plan-fit note MUST state "move to Vercel Pro before the first paying client".

### Key Entities

- **Deployment environment**: Local, Preview, Production. Each has its own database, secrets, demo switch value, indexable value and site URL. Production is our public demo.
- **Required setting**: a named configuration value; attributes: which tier(s), required-in-production yes/no, secret yes/no, default (if any), set where (dashboard/config), changes need redeploy yes/no.
- **Monitor**: a check target (URL), interval, alert channels, owner.
- **Backup**: timestamp, source environment, storage location, encryption, retention expiry, verified-by-drill yes/no.
- **Restore point**: a named database snapshot taken before a migration deploy; linked to the release.
- **Release**: a website version and an API version deployed from one commit; has smoke-test result and rollback target.
- **Incident note**: what broke, impact, timeline, cause, fix, prevention test added.

## Constraints, Invariants and Non-Goals

### Free-tier limits that could bite, and how we stay inside them

Figures below come from the audit and general knowledge, **not** from our accounts; each MUST be verified in the host dashboards during planning and recorded in the plan-fit note (FR-073).

| Host | Limit that could bite | How we stay inside it |
|---|---|---|
| Vercel Hobby | **Non-commercial use only** (terms); fixed monthly bandwidth / function invocations; one function region per project | The deployment is a non-commercial portfolio demo: no prices, sales pitch or "hire us" button (FR-075). Region set to Singapore. Usage checked weekly; move to Pro before the first paying client. |
| Render Free | 750 free instance hours per **workspace** (verified 2026-10-09); running out suspends **all** free services | **Not used for Shuaib Health** (ADR-0011). The owner's workspace already spends ~744 h on `kbg-backend`. The API runs on the Vercel Hobby account and shares the website's allowance (4 h Active CPU, 1M invocations, 360 GB-h); if that runs out, the demo pauses until month end and billing is never enabled. |
| Neon Free | Compute **autosuspends after ~5 min idle** (not adjustable on free); **monthly compute-hour allowance per project**; small storage cap; short point-in-time history window | Database is allowed to sleep; never pinged every 5 min. Readiness checked at most hourly (each wake ≈ 5 min of minimum compute) — well under the allowance. Production in its own project, separate from dev, so dev work does not consume production compute. Storage stays small thanks to demo purge rules (Feature 005/006). Off-platform daily backup covers the short history window. |
| GitHub Actions | Repo is **public** → standard runner minutes free; artifacts of public repos are readable by signed-in users | Backups MUST NOT be stored as plaintext artifacts in this repo (FR-056). |
| UptimeRobot Free | ~5-minute minimum interval; limited monitors; SMS/voice are paid | Use 5-min interval, ≤ 5 monitors; alerts by mobile-app push + email (free). |
| Error tracking free tier | Monthly event quota; one seat | Sample/deduplicate; scrub personal data; app unaffected when quota is exhausted. |

### Invariants
- No secret in the repository, logs, CI output or chat (Constitution VI).
- Browser never calls the API origin directly; the cookie design is unchanged (audit Q&A 2).
- Existing tests are not deleted or loosened; full suites green in single sequential runs.
- Migrations additive and reversible with tested downgrade.
- Demo data never mixes with real data; demo switch ON for this deployment; `indexable` OFF.
- Seed's production refusal is not weakened.

### Non-goals (out of scope)
- Real clinic clients, per-client deployments, paid plans, buying or connecting a custom domain, turning indexing on, new product features, scaling beyond one API instance, shared rate-limit store, switching the session cookie to `Lax` (N2).

## Traceability to the audit

| Audit item | Covered by |
|---|---|
| B1 No deploy config / no CI | FR-001–005, FR-040–045 |
| B2 Migrations not on deploy; seed/admin path | FR-010–016 |
| B3 Rate limiting behind proxies | FR-030–033 |
| B4 Fail-open demo defaults | FR-020, FR-023 |
| B5 `SITE_URL` localhost default | FR-021, FR-024 |
| I1 Function region | FR-002 |
| I2 Cold starts | FR-051, FR-070, User Story 7 |
| I3 Keep-alive vs database compute | FR-051, Constraints table |
| I4 Backups | FR-055–059 |
| I5 Uptime monitoring | FR-050, FR-053 |
| I6 Seed/runbook gaps; indexable off | FR-013–015, FR-022, FR-071 |
| I7 Plan fit | FR-073, Constraints table |
| I8 Per-process limiter | FR-034 (now shared in Postgres) |
| Owner conditions C1–C4 (ADR-0011) | FR-076, FR-034 (C2), FR-077, FR-078 |
| Constitution XI flags | FR-079 |
| N1 Prefer platform IP header | FR-032 (optional, included) |
| N2 `SameSite=Strict` UX | Non-goal; documented in runbook |
| N3 Route listing in production | FR-066 (optional, included) |
| N4 Start command flags | FR-004 |
| N5 Runtime version pins | FR-001 |
| N6 Dependency hygiene | FR-045, FR-061, FR-062 |
| Audit E1 (sign-in on preview/custom domain) | Edge Cases, FR-024, FR-060 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor on a mid-range phone on mobile data can open the live demo, book an appointment and open the demo dashboard in under 3 minutes, with no blank error screen, when services are warm.
- **SC-002**: The live home page and one catalog page score ≥ 90 on Lighthouse mobile for Performance, Accessibility and Best Practices (warm). SEO scores ≥ 90 on the test-only `indexable=true` build.
- **SC-003**: 95% of catalog and booking API requests on the live deployment complete in under 1 second, warm.
- **SC-004**: 100% of pull requests to `main` after this feature are blocked from merging until all four required checks pass, and only the owner can merge (the owner's merge click is the approval).
- **SC-005**: The owner receives an outage alert on their phone within 10 minutes of the API or website going down, and a recovery notice after it returns.
- **SC-006**: The website can be rolled back to the previous version in under 2 minutes and the API in under 10 minutes, by following the runbook alone.
- **SC-007**: One restore drill completes successfully in under 30 minutes and is recorded.
- **SC-008**: Zero `localhost` references and zero secrets in any live page, header, sitemap, robots file, deploy config or repository history scan.
- **SC-009**: Zero high-severity dependency findings without an owner-approved, dated allow-list entry.
- **SC-010**: After 7 days live, every free-tier usage figure projects to ≤ 80% of its monthly allowance; total hosting spend is $0.
- **SC-011**: The live smoke-test checklist passes in full on the first production deploy and on a real phone.
- **SC-012**: A burst of 100 website-origin catalog requests in one minute produces zero rate-limit rejections, while a single external client exceeding the public limit is rejected.

## Assumptions

- The GitHub repository is public (verified 2026-10-09), so standard CI minutes and branch protection are free.
- Accounts for Vercel, Render, Neon, UptimeRobot and the error tracker will be created by the owner during implementation; this spec creates none.
- The live URL is the free host-provided subdomain (e.g. `*.vercel.app`, `*.onrender.com`) until a custom domain is bought in a later feature.
- Error tracking defaults to a widely used free-tier service supporting both Python and Next.js with server-side scrubbing; final choice in plan.
- "Phone alerts" = free mobile-app push notifications + email (SMS/voice are paid on free monitor tiers).
- Keep-alive for the API uses the uptime monitor itself (5-min liveness checks), so no extra service is needed.
- Readiness checks against the database run at most hourly; acceptable that the first visitor after idle waits for the database to wake.
- Visitors to the public demo may type real-looking personal details into booking; existing demo purge rules (7 days) apply, and backups are encrypted because of this.
- E2E tests are attempted in CI first; if run time or flakiness is unacceptable they stay owner-run before merge (FR-041).
- New behaviour sits behind flags that are OFF in code (FR-079), so local development and existing tests behave as today unless a test turns a flag on. Production must set every flag explicitly.

## Open Questions

None outstanding — Q1 and Q2 answered in Clarifications (2026-10-09). API host decided in plan + ADR.
