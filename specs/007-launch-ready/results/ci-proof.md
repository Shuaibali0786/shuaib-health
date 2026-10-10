# CI proof (T037)

Date: 2026-10-10. A throwaway PR (#9, from branch `throwaway/ci-proof`, now closed and its branch deleted) added four deliberate problems on top of PR-1. Run `38044594297`.

| Deliberate problem | Check that caught it | What the log shows |
|---|---|---|
| React hook called conditionally in `frontend/src/lib/ci-proof.tsx` | `frontend` (eslint) **failed** | file path, `5:5 error ... react-hooks/rules-of-hooks` |
| Unused import in `backend/app/ci_proof.py` | `backend` (ruff check) **failed** | `F401 ... --> app/ci_proof.py:1:8` |
| A fake AWS-key-shaped value in `docs/ci-proof-fake-secret.txt` | `secrets` (gitleaks) **failed** | `RuleID: aws-access-token`, `File: docs/ci-proof-fake-secret.txt`, a link to line 2, and `Secret: REDACTED` / `Finding: ... REDACTED` (the value is not in the log) |
| A dummy `frontend/.env` added with `git add -f` | `secrets` (.gitignore check) **failed** | `frontend/.env is not ignored by .gitignore` (see note) |

Both `secrets` steps ran and reported in the same job, because the `.gitignore` step uses `if: always()`.

Note: for a file that is already tracked, plain `git check-ignore` says "not ignored", so the message was slightly misleading. The check now uses `--no-index`, which tests the ignore pattern itself, and the following step still names any tracked `.env` file. Both outcomes block the merge.

The e2e parts of that run were cancelled on purpose (they would have passed and only cost minutes).

## Branch protection on `main` and the merge block (T038, T037 second half)

Date: 2026-10-10. Branch protection was switched on by Claude through the GitHub API, on the owner's explicit instruction. Settings read back from the API afterwards:

| Setting | Value |
|---|---|
| Required status checks | `backend`, `frontend`, `secrets`, `e2e` |
| Branch must be up to date before merging | yes (`strict: true`) |
| Pull request required before merging | yes |
| Required approving reviews | 0 (the owner's merge click is the approval) |
| Force pushes | blocked |
| Branch deletion | blocked |
| Include administrators (no bypass) | yes (`enforce_admins: true`) |
| Push restrictions / bypass list | none |

Before the change `main` had no protection and no rulesets, and the owner was the only collaborator.

### Proof that a red check blocks the merge, for the owner's admin account too

A throwaway PR (#10, branch `throwaway/ci-proof-2`, now closed and the branch deleted) added one unused import to `backend/app/ci_proof2.py`. Run `38048608733`.

| What | Result (read from the API while `backend` was red) |
|---|---|
| `backend` check | **failed** (ruff F401) |
| `secrets` check | passed |
| `frontend` and the `e2e` parts | still running |
| REST `mergeable_state` | **`blocked`** |
| GraphQL `mergeStateStatus` | **`BLOCKED`** |
| GraphQL `viewerCanMergeAsAdmin` (the owner's own account) | **`false`** |
| GraphQL `viewerCanEnableAutoMerge` | `false` |

So with a required check red the PR cannot be merged by the owner's administrator account: there is no bypass. The e2e parts of that run were cancelled on purpose. No merge was attempted on the throwaway PR (it would have been unsafe to try).

### Direct push to `main`

Not tried, on purpose. From the rules: a pull request is required, administrators are included, force pushes and deletion are blocked, and the four checks must pass on an up-to-date branch, so a direct push would be rejected.

### Contract acceptance checks (ci-checks.md)

- [x] A PR with a lint error: `frontend` or `backend` fails, merge blocked (PR #9 and PR #10).
- [x] A PR adding a fake AWS-key-shaped string: `secrets` fails; the log shows the path and line, not the value (PR #9).
- [x] A PR with any required check failing or pending: merge blocked, also for the owner as administrator (PR #10: `BLOCKED`, `viewerCanMergeAsAdmin: false`).
- [x] Repository settings: 0 required approvals, administrators included, force-push and deletion blocked, and no collaborator with write access other than the owner.
- [x] A PR that commits a `.env` file: `secrets` fails on the `.gitignore` check (PR #9).
- [x] CI logs contain no value from any `*_SECRET`, `*_KEY` or `*_URL` setting (the only keys are random per run and never echoed).
- [ ] A PR that adds a JS bundle over the budget: `e2e` fails on the Lighthouse budget. Proven locally (a lowered budget made `lhci assert` fail with `resource-summary.script.size`), not yet as a PR.
