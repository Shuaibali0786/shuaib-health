# Runbooks

Short, tested steps for running Shuaib Health. Written in Phases 7–9 of `specs/007-launch-ready/tasks.md`; links to documents not yet written are placeholders.

| Runbook | Purpose | Status |
|---|---|---|
| [first-deploy.md](first-deploy.md) | First live deployment, every owner step marked | planned (T052) |
| [smoke-test.md](smoke-test.md) | Live smoke checklist | planned (T053) |
| [deploy.md](deploy.md) | Routine deploy | planned (T088) |
| [rollback.md](rollback.md) | Roll back website, API, database, flags | planned (T089) |
| [new-env-var.md](new-env-var.md) | Adding an environment variable safely | planned (T091) |
| [secret-rotation.md](secret-rotation.md) | Rotating each secret | planned (T092) |
| [custom-domain-prep.md](custom-domain-prep.md) | Moving to a custom domain | planned (T093) |
| [backup-workflow.yml.example](backup-workflow.yml.example) | Daily encrypted backup workflow template | planned (T080) |
| [restore-drill.md](restore-drill.md) | Restore a backup into a scratch branch | planned (T081) |
| [migration-restore-point.md](migration-restore-point.md) | Restore point before a migration | planned (T082) |
| [free-tier-usage.md](free-tier-usage.md) | Reading usage and projecting month end | planned (T097) |
| [plan-fit.md](plan-fit.md) | Free-tier limits and what changes before paid clients | planned (T098) |
| [../incidents/TEMPLATE.md](../incidents/TEMPLATE.md) | Incident note template | planned (T090) |

Rule: billing is never enabled on any host. If a free allowance runs out, the demo pauses until month end.
