# Evidence files for 007-launch-ready

Every file below is produced by this feature. No file may contain a secret value, a database URL or personal data.

| File | Produced by | Task | Status |
|---|---|---|---|
| `baseline.md` | "Before" pass counts of every existing suite | T001 | Phase 1 |
| `gitleaks-history.md` | gitleaks over full git history (redacted) | T004 | Phase 1 |
| `ci-budget-baseline.md` (in `lighthouse/`) | Measured build sizes behind the Lighthouse CI budgets | T114 | Phase 3 |
| `visual-linux-baselines.md` | Pixel-diff report, win32 vs linux baselines | T115 | Phase 3 |
| `ci-proof.md` | Throwaway PR: lint error, fake secret, `.env` commit, merge blocked | T037 | Phase 3 |
| `cold-start.md` | Cold and warm latency on the API preview (C4 gate) | T059 | Launch |
| `smoke-<date>.md` | Live smoke test on desktop | T065 | Launch |
| `phone-qa/` | Real-device screenshots and notes | T066 | Launch |
| `lighthouse/` | Lighthouse mobile JSON/HTML (live) and `seo-indexable-test.md` | T067, T112 | Launch |
| `p95.md` | API p95 on the live API | T068 | Launch |
| `alert-test.md` | Phone alert and recovery times | T078 | Launch |
| `sentry-check.md` | Scrubbing verdict | T079 | Launch |
| `restore-drill.md` | Backup restore drill (duration, row counts) | T086 | Launch |
| `rollback-rehearsal.md` | Timed rollback of website and API | T095 | Launch |
| `usage-day7.md` | Day-7 usage and month-end projection | T100 | Launch |
| `final-suites.md` | Final suites, gitleaks, npm audit, pip-audit vs baseline | T101, T102 | Polish |
