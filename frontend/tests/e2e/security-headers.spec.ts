import { expect, test } from "@playwright/test";

// The main test server runs with SITE_SECURITY_HEADERS=report (playwright.config.ts).
const COMMON = ["strict-transport-security", "x-content-type-options", "x-frame-options", "permissions-policy"];

test.describe("security headers", () => {
  for (const path of ["/", "/doctors", "/doctors/dr-ayesha-rahman"]) {
    test(`public page ${path} carries the site-wide headers, with the CSP in report-only mode`, async ({ request }) => {
      const headers = (await request.get(path)).headers();
      for (const name of COMMON) expect(headers[name], `${path} ${name}`).toBeTruthy();
      expect(headers["strict-transport-security"]).not.toMatch(/preload/i);
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["content-security-policy-report-only"]).toContain("default-src 'self'");
      expect(headers["content-security-policy"]).toBeUndefined();
    });
  }

  test("/admin/login keeps its own private headers unchanged and gains the common ones", async ({ request }) => {
    const headers = (await request.get("/admin/login", { maxRedirects: 0 })).headers();
    for (const name of COMMON) expect(headers[name], name).toBeTruthy();
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
  });

  test("the home page raises no CSP violation in the console", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (message) => messages.push(message.text()));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(messages.filter((text) => /content security policy/i.test(text))).toEqual([]);
  });
});
