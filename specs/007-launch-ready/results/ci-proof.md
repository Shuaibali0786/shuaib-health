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

## Still to prove after the owner enables branch protection (T038)

- [ ] With a required check red, GitHub's **Merge** button is disabled **for the owner's administrator account too** (no bypass). This can only be checked after branch protection is on; Claude cannot turn it on. Steps for the owner are in the PR description.
- [ ] Repository settings show 0 required approvals, administrators included, force-push and deletion blocked.
