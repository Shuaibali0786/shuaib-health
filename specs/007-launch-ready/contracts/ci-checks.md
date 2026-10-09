# Contract: Required CI Checks (pull requests to `main`)

Workflow `.github/workflows/ci.yml`, trigger `pull_request` (branches: main) and `push` to main. No production secrets. All of these are **required status checks** in branch protection.

| Job | Steps | Passes when |
|---|---|---|
| `backend` | uv sync (frozen) → ruff check → ruff format --check → mypy → pytest (Postgres 16 service container as `TEST_DATABASE_URL`) → alembic upgrade head / downgrade -1 / upgrade head on a scratch DB → pip-audit | all steps exit 0; pip-audit has no high findings outside the allow-list |
| `frontend` | npm ci → eslint → tsc --noEmit → vitest run → `next build` → `next build` with `CATALOG_API_URL=http://127.0.0.1:9` (dead) → npm audit --audit-level=high, filtered by `audit-allowlist.json` | all steps exit 0 |
| `secrets` | gitleaks detect on the PR commit range, config `.gitleaks.toml`, output redacted → **`.gitignore` check** (Constitution VI): `git check-ignore` confirms `.env`, `backend/.env`, `frontend/.env*` (except `*.example`) are ignored, and `git ls-files` lists no tracked `.env` file other than `*.env.example` | no findings; check passes |
| `e2e` | start backend (uv) + frontend (`next start`) against the service container, seeded with demo data → Playwright (existing configs) → **Lighthouse CI** (Constitution VIII), mobile preset, 3 runs on `/` and one catalog page, config `frontend/lighthouserc.json` | all specs pass; Lighthouse: Accessibility and Best Practices ≥ 0.90 (**error**), resource budgets (`frontend/lighthouse-budget.json`) not exceeded (**error**), Performance ≥ 0.90 (**warn** on shared CI runners; the live measurement T067 is the binding gate); SEO isn't asserted (noindex demo; see T112); all within the 20 min job timeout |

Visual baselines: CI runs on Linux, so Linux baselines (`-linux.png`) are added next to the existing `-win32.png` ones, with an owner-approved pixel-diff report (T115, T116). Windows baselines stay for local runs.

All four checks are **always required**, e2e included (Constitution IX). There is no optional or "run locally instead" fallback. A flaky spec is fixed; quarantine needs the owner's written approval in the PR.

## Branch protection on `main` (owner decision, 2026-10-09)
- Require the 4 checks above, and branches up to date before merge.
- **Required approving reviews: 0.** PRs are opened from the owner's account and GitHub forbids self-approval. **The owner's merge click is the approval** (playbook rule 6). Only the owner has write access.
- Block force pushes and deletion; **include administrators** (no bypass of required checks).

## Acceptance checks
- [ ] A PR with a lint error → `frontend` or `backend` fails → merge blocked.
- [ ] A PR adding a fake AWS-key-shaped string → `secrets` fails; the log shows the path and line, not the value.
- [ ] A PR with any required check failing or pending → merge blocked, **also for the owner as administrator**.
- [ ] Repository settings show 0 required approvals, admins included, force-push disabled, and no collaborator with write access other than the owner.
- [ ] CI logs contain no value from any `*_SECRET`, `*_KEY` or `*_URL` setting.
- [ ] A PR that commits a `.env` file (dummy content) → `secrets` fails on the `.gitignore` check.
- [ ] A PR that adds a JS bundle over the budget → `e2e` fails on the Lighthouse budget.
