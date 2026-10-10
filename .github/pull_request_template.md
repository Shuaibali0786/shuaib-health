## Summary

<!-- What changed and why. Link the spec/PHR. -->

## Tests changed

<!-- Old tests are never deleted or loosened (playbook rule 4). List every existing test file you touched and exactly what was added or moved. Write "none" if there are none. -->

## Before every release — checklist (docs/SAFE-CHANGE-PLAYBOOK.md §7)

- [ ] All suites green (single clean runs) · types/lint clean
- [ ] Visual diffs reviewed
- [ ] gitleaks clean · audits reviewed
- [ ] Migration up/down tested · backup taken
- [ ] Migration present → a Neon restore point was taken first ([runbook](../docs/runbooks/migration-restore-point.md))
- [ ] Env vars set on both Vercel projects (website, API) for any new key ([runbook](../docs/runbooks/new-env-var.md))
- [ ] Feature flag default decided
- [ ] Lighthouse mobile ≥ 90 · API p95 < 1 s
- [ ] Demo smoke test on live + phone test ([runbook](../docs/runbooks/smoke-test.md))
- [ ] Rollback plan known ([runbook](../docs/runbooks/rollback.md))

## Hosting and merge rules

- [ ] No prices, sales pitch or "hire us" call to action added (Vercel Hobby is non-commercial)
- [ ] `e2e` is a required check. Any quarantined test has the owner's written approval in this PR
- [ ] The owner's merge click is the approval (0 required reviews; administrators get no bypass)

Runbooks: [index](../docs/runbooks/README.md) · [deploy](../docs/runbooks/deploy.md) · [rollback](../docs/runbooks/rollback.md) · [first deploy](../docs/runbooks/first-deploy.md)
