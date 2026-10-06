import { expect, type BrowserContext } from "@playwright/test";

/** The session cookie of the mock API's test sessions (tests/mock-api/admin.mjs). */
export const SESSION_COOKIE = "__Host-cc_session";

export const SESSIONS = {
  admin: "cs_e2e-admin",
  receptionist: "cs_e2e-receptionist",
  demo: "cd_e2e-demo",
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
