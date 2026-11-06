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

/**
 * ASSISTANT_ENABLED: the chat assistant (Feature 010, ADR-0013). OFF by default: only "true", "1", "yes" or
 * "on" turn it on. Read when asked; the public pages are rendered at build or revalidation time, so set it
 * before building, like DEMO_ENABLED. When off, no assistant code or data is in any page. It lives in this
 * file because this is the one place the public site reads its feature switches.
 */
export function isAssistantEnabled(): boolean {
  const raw = process.env.ASSISTANT_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}
