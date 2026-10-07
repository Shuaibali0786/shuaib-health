import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** The session cookie of the mock API's test sessions (tests/mock-api/admin.mjs). */
export const SESSION_COOKIE = "__Host-cc_session";

export const SESSIONS = {
  admin: "cs_e2e-admin",
  receptionist: "cs_e2e-receptionist",
  demo: "cd_e2e-demo",
  /** A demo visitor outside clinic hours: the demo shows a typical clinic day. */
  demoTypical: "cd_e2e-demo-typical",
  /** A receptionist whose Overview is a clinic holiday. */
  closed: "cs_e2e-closed",
  /** A receptionist whose Overview is a day with no bookings. */
  empty: "cs_e2e-empty",
} as const;

/** Signs a browser context in as one of the mock API's test sessions, as the real sign-in would. */
export async function signIn(context: BrowserContext, who: keyof typeof SESSIONS, baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    { name: SESSION_COOKIE, value: SESSIONS[who], domain: url.hostname, path: "/", secure: true, httpOnly: true, sameSite: "Strict" },
  ]);
}

export async function setTheme(context: BrowserContext, theme: "light" | "dark" | "system", baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([{ name: "cc_theme", value: theme, domain: url.hostname, path: "/admin", sameSite: "Lax" }]);
}

/** Headers every staff page and every /api/admin response must carry (FR-037). */
export function expectPrivateHeaders(headers: Record<string, string>, label: string): void {
  expect(headers["cache-control"], `${label}: cache-control`).toContain("no-store");
  expect(headers["x-robots-tag"], `${label}: x-robots-tag`).toContain("noindex");
  expect(headers["referrer-policy"], `${label}: referrer-policy`).toContain("no-referrer");
  expect(headers["content-security-policy"], `${label}: content-security-policy`).toContain("frame-ancestors 'none'");
}

/**
 * Axe violations for WCAG 2.2 AA. The one exception is the 24 px target size of the Overview timeline chips: each is one
 * 15-minute slot of a time-proportional agenda (about 20 px wide at 1440 px, as in the approved preview), so a larger target
 * would break the scale. Every other target is checked. See results.md, Phase 6, open decision.
 */
export async function wcagViolations(page: Page): Promise<string[]> {
  const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
  const main = await new AxeBuilder({ page }).withTags(tags).disableRules(["target-size"]).analyze();
  const sizes = await new AxeBuilder({ page }).withRules(["target-size"]).exclude(".tl-b").analyze();
  return [...main.violations, ...sizes.violations].map((v) => `${v.id} (${v.impact}) on ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}
