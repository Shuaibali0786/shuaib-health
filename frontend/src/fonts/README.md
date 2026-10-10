# Self-hosted fonts

These three files are the exact latin-subset variable `woff2` files that `next/font/google` used to download at
build time (same bytes: they were fetched with the same user agent Next uses and match the build output
byte for byte). They are committed so a build never depends on reaching Google.

| File | Family | Used by |
|---|---|---|
| `plus-jakarta-sans-latin-variable.woff2` | Plus Jakarta Sans (weights 200–800) | public site headings |
| `inter-latin-variable.woff2` | Inter (weights 100–900) | public site body, staff app (400–600) |
| `cormorant-garamond-latin-variable.woff2` | Cormorant Garamond (weights 300–700 file; 500–700 used) | staff app display type |

All three are licensed under the SIL Open Font License 1.1, which allows bundling and redistribution.
The CSS variables (`--font-jakarta`, `--font-inter`, `--font-admin-inter`, `--font-cormorant`) are unchanged.
