---
id: 031
title: Full security review attacker view
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: none
branch: feat/assistant-v1-1
user: Shuaibali0786
command: security review (read-only)
labels: ["security","review","auth","2fa","assistant","csp","audit","gitleaks"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - history/prompts/general/031-full-security-review.general.prompt.md
tests:
 - gitleaks git (full history, 228 commits): no leaks
 - pip-audit (locked backend deps): no known vulnerabilities
 - npm audit: prod 5 moderate (build-time Sentry plugin/minimatch); 8 high all dev-only (Lighthouse CI chain)
---

## Prompt

Read first: docs/SAFE-CHANGE-PLAYBOOK.md, the constitution, specs/007-launch-ready/results/STATUS-2026-11-06.md and the latest MORNING-REPORT. Live now: Command Centre, specialty presets, assistant v1.1 (Claude provider OFF), admin 2FA (migration 0004), CSP report-only with 0 violations.

Next: a full security review of the whole project, as an attacker would see it. Read-only first.
1. Auth: admin login, sessions, cookies, 2FA flow, password reset, brute force (lockout after failed logins?), role checks on every admin route.
2. API: every public endpoint, input validation, rate limits, error messages that leak details, CORS, booking and assistant endpoints (spam, injection, idempotency).
3. Assistant: prompt-injection (when the AI provider is on); can it ever read or reveal private data, staff details, other bookings or secrets?
4. Data: what personal data is stored, masked, logged; anything in logs, URLs or Sentry that should not be there.
5. Headers/CSP, cookie flags, HTTPS, dependency audit, secrets in the repo history (gitleaks full history).
6. Infra: Vercel/Neon/Sentry settings visible from the repo; anything public that should be private.

Output: a table sorted by risk: finding | risk (critical/high/medium/low) | where | fix | effort.
Then fix all critical and high items in ONE PR with tests, same merge process (merge only when all checks green, smoke test after merge, roll back and STOP if anything fails). If a fix needs a database migration, tell me BEFORE pushing.
Medium/low: list only.
Report short and STOP.

## Response snapshot

Read-only review of backend auth (Argon2id, opaque HMAC-hashed tokens, __Host- httpOnly SameSite=Strict cookies, session-bound CSRF, per-email lockout + per-IP limit, 2FA with replay guard and attempt cap), every admin route (require_viewer policy + route-policy test), public endpoints, BFF proxies, assistant (server-side public pack only, no tools), logging/Sentry scrubbing, headers/CSP, CI, Vercel settings (fork protection ON, SSO on deployment URLs). No critical or high findings, so no PR was opened. Medium: booking reference in backend access-log path; public CSP still report-only and staff app has no script CSP; change-password current-password check not throttled; 2FA optional for admins. Low: admin lockout DoS by email, slot-filling by distributed IPs, reveal-phone unthrottled, dev-only npm highs, actions pinned by tag, web HSTS without includeSubDomains, assistant off-topic steering.

## Outcome

- ✅ Impact: security posture documented; nothing critical/high to fix
- 🧪 Tests: gitleaks, pip-audit, npm audit run (results above)
- 📁 Files: this PHR only
- 🔁 Next prompts: owner picks which medium items to fix (CSP enforce T069, log path template, change-password throttle, enforce 2FA for admins)
- 🧠 Reflection: auth stack was already built to a high bar; remaining risk is hardening, not holes

## Evaluation notes (flywheel)

- Failure modes observed: Vercel MCP scope 403; CLI fallback worked read-only
- Graders run and results (PASS/FAIL): n/a
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a
