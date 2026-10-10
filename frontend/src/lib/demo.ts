/**
 * DEMO_ENABLED: the portfolio's read-only demo dashboard. On by default; a real clinic deployment sets
 * `DEMO_ENABLED=false` and the gold top bar, the demo buttons (footer, About, sign-in) and the demo entry
 * route all disappear. The backend reads the same name and then answers 404 to the demo and serves no demo
 * data. Read when asked (not at import), so a test or a restart with another value is honoured; the public
 * pages are rendered at build or revalidation time, so set it before building.
 *
 * On Vercel (`VERCEL_ENV` production or preview) the value must be set explicitly: a missing value fails
 * the build instead of silently turning the demo on or off. Local runs and tests keep the default.
 */
export function isDemoEnabled(): boolean {
  const raw = process.env.DEMO_ENABLED?.trim().toLowerCase();
  const vercelEnv = process.env.VERCEL_ENV;
  if (!raw && (vercelEnv === "production" || vercelEnv === "preview")) {
    throw new Error("DEMO_ENABLED must be set explicitly on Vercel (true or false).");
  }
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}
