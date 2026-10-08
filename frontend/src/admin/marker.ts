/**
 * Present in every admin script chunk and in no public one. The isolation proofs
 * (scripts/check-admin-isolation.mjs and tests/e2e/admin-isolation.spec.ts) search public routes'
 * JavaScript and CSS for this exact string; finding it there means admin code leaked into the site.
 */
export const __SH_COMMAND_CENTRE__ = "__SH_COMMAND_CENTRE__";
