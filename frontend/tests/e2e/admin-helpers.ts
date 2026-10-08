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

/**
 * With the page clock paused, React reveals streamed content (a screen that has a loading skeleton) and hydrates it on
 * animation frames and timers that a paused clock never delivers. So it moves the clock on by a few 20 ms steps, which
 * moves nothing that a test looks at (the clock text, the count-up's final number, the Now line), until the page has
 * hydrated. React marks a DOM node it has hydrated with a `__reactFiber$` property; the page's heading block is
 * checked. (Polled from the test, not with `waitForFunction`, which polls on the page's own frames.)
 */
export async function revealStreamedContent(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle"); // the scripts arrive in real time
  let steps = 0;
  await expect
    .poll(
      async () => {
        // At most five steps of 20 ms: hydration needs a frame or two, then goes on in real time, and a busy machine
        // must not push the paused clock (and so what the tests read from it) on by whole seconds.
        if (steps < 5) {
          steps += 1;
          await page.clock.runFor(20);
        }
        return page.evaluate(() => {
          const block = document.querySelector("#main-content .page-head");
          return block === null || Object.keys(block).some((key) => key.startsWith("__reactFiber$"));
        });
      },
      { timeout: 15_000, intervals: [50, 100, 200] },
    )
    .toBe(true);
}

/**
 * Moves a paused clock on until the demo has simulated its first online booking (50 s after the Overview opened)
 * and its "New booking" toast is on screen. The demo's timer starts when the page hydrates, which can be a moment
 * after the test starts moving the clock, so it steps on in seconds instead of guessing one exact distance.
 */
export async function runUntilNewBookingToast(page: Page): Promise<void> {
  await page.clock.runFor(50_000);
  await expect(async () => {
    await page.clock.runFor(1_000);
    await expect(page.getByTestId("new-booking-toast").first()).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 15_000 });
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
