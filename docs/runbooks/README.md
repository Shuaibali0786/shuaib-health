# Runbooks

Short steps for running Shuaib Health, written in Phases 7–9 of `specs/007-launch-ready/tasks.md`. Merging to `main` auto-deploys production: start with [deploy.md](deploy.md).

| Runbook | Purpose | Status |
|---|---|---|
| [first-deploy.md](first-deploy.md) | First live deployment, every owner step marked | written (T052) |
| [smoke-test.md](smoke-test.md) | Live smoke checklist | written (T053) |
| [deploy.md](deploy.md) | Routine deploy | written (T088) |
| [rollback.md](rollback.md) | Roll back website, API, database, flags | written (T089) |
| [new-env-var.md](new-env-var.md) | Adding an environment variable safely | written (T091) |
| [secret-rotation.md](secret-rotation.md) | Rotating each secret | written (T092) |
| [custom-domain-prep.md](custom-domain-prep.md) | Moving to a custom domain | written (T093) |
| [backup-workflow.yml.example](backup-workflow.yml.example) | Daily encrypted backup workflow template | written (T080) |
| [restore-drill.md](restore-drill.md) | Restore a backup into a scratch branch | written (T081) |
| [migration-restore-point.md](migration-restore-point.md) | Restore point before a migration | written (T082) |
| [backup-setup.md](backup-setup.md) | Owner steps and the helper script for backups | written (T083 to T085 prep) |
| [free-tier-usage.md](free-tier-usage.md) | Reading usage and projecting month end | planned (T097) |
| [plan-fit.md](plan-fit.md) | Free-tier limits and what changes before paid clients | planned (T098) |
| [../incidents/TEMPLATE.md](../incidents/TEMPLATE.md) | Incident note template | written (T090) |

Rule: billing is never enabled on any host. If a free allowance runs out, the demo pauses until month end.
