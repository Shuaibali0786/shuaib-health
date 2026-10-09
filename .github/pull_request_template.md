## Summary

<!-- What changed and why. Link the spec/PHR. -->

## Before every release — checklist (docs/SAFE-CHANGE-PLAYBOOK.md §7)

- [ ] All suites green (single clean runs) · types/lint clean
- [ ] Visual diffs reviewed
- [ ] gitleaks clean · audits reviewed
- [ ] Migration up/down tested · backup taken
- [ ] Env vars set on Vercel/Render for any new key
- [ ] Feature flag default decided
- [ ] Lighthouse mobile ≥ 90 · API p95 < 1 s
- [ ] Demo smoke test on live + phone test
- [ ] Rollback plan known
