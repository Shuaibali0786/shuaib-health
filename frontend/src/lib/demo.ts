/**
 * DEMO_ENABLED: the portfolio's read-only demo dashboard. On by default; a real clinic deployment sets
 * `DEMO_ENABLED=false` and the gold top bar, the demo buttons (footer, About, sign-in) and the demo entry
 * route all disappear. The backend reads the same name and then answers 404 to the demo and serves no demo
 * data. Read when asked (not at import), so a test or a restart with another value is honoured; the public
 * pages are rendered at build or revalidation time, so set it before building.
 */
export function isDemoEnabled(): boolean {
  const raw = process.env.DEMO_ENABLED?.trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}
