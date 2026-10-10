# gitleaks — full git history (T004, FR-064)

- Date: 2026-10-10
- Tool: gitleaks 8.30.1, `detect --redact --log-opts=--all`, config `.gitleaks.toml` (default rules + path-scoped test-fixture allow-list)
- Scope: 119 commits, about 6.5 MB
- Result: **no leaks found**. No rotation needed.
- No secret values were printed or saved (report kept outside the repo).
