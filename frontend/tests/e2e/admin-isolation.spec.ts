import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { ALL_PATHS } from "./helpers";
import { expectPrivateHeaders, signIn } from "./admin-helpers";

// The staff app must not leak into the public site (ADR 0008, FR-036/FR-037, SC-009), and every staff
// page and BFF response must be private. The build-time twin is scripts/check-admin-isolation.mjs.

const MARKER = "__SH_COMMAND_CENTRE__";
const ADMIN_CSS_TOKENS = ["--color-night-", "bottom-nav", "data-theme-pref", "live-pill", "Cormorant Garamond"];
const CHUNKS = join(process.cwd(), ".next", "static", "chunks");

/** File names of the script and stylesheet chunks of the production build that carry admin code or styles. */
function adminChunkNames(): string[] {
  return readdirSync(CHUNKS)
    .filter((name) => /\.(js|css)$/.test(name))
    .filter((name) => {
      const text = readFileSync(join(CHUNKS, name), "utf8");
      return text.includes(MARKER) || (name.endsWith(".css") && ADMIN_CSS_TOKENS.some((token) => text.includes(token)));
    });
}

type Seen = { url: string; type: string; body: string | null };

/** Collects every script, stylesheet and font the page requests, with text bodies for scripts and styles. */
function watchAssets(page: Page): Seen[] {
  const seen: Seen[] = [];
  page.on("response", async (response) => {
    const type = response.request().resourceType();
    if (!["script", "stylesheet", "font"].includes(type)) return;
    let body: string | null = null;
    if (type !== "font") {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }
    seen.push({ url: response.url(), type, body });
  });
  return seen;
}

test.describe("public pages carry no staff code", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!["admin-desktop", "admin-mobile"].includes(testInfo.project.name), "isolation does not depend on the viewport; desktop and phone cover prefetch behaviour");
  });

  test("the production build has admin chunks (so the checks below are not vacuous)", () => {
    expect(adminChunkNames().length).toBeGreaterThanOrEqual(2);
  });

  for (const path of ALL_PATHS) {
    test(`${path}: no admin script, style or font, idle or after hover and scroll prefetch`, async ({ page }) => {
      const admin = adminChunkNames();
      const seen = watchAssets(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const html = await response!.text();
      expect(html, "HTML").not.toContain(MARKER);
      expect(html, "HTML mentions the admin display font").not.toMatch(/Cormorant/i);
      for (const token of ADMIN_CSS_TOKENS) expect(html, `inline CSS contains ${token}`).not.toContain(token);

      await page.waitForLoadState("networkidle");
      // Hovering and scrolling is what triggers link prefetching in the App Router.
      for (const link of (await page.locator("a[href^='/']").all()).slice(0, 12)) await link.hover({ timeout: 1000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForLoadState("networkidle");

      for (const asset of seen) {
        const file = asset.url.split("?")[0]!.split("/").pop()!;
        expect(admin, `${path} requested admin chunk ${file}`).not.toContain(file);
        expect(asset.url, `${path} requested an admin route asset`).not.toMatch(/\/admin\b/);
        if (asset.body !== null) {
          expect(asset.body, `${asset.url} contains the admin marker`).not.toContain(MARKER);
          for (const token of ADMIN_CSS_TOKENS) expect(asset.body, `${asset.url} contains ${token}`).not.toContain(token);
        }
      }
      expect(seen.length, "the page loaded assets at all").toBeGreaterThan(0);
    });
  }

  test("the public pages never link to the staff app (no prefetchable admin link)", async ({ page }) => {
    for (const path of ["/", "/about", "/contact"]) {
      await page.goto(path);
      const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.filter((href) => /^\/?admin|\/admin(\/|$)/.test(href)), path).toEqual([]);
    }
  });
});

test.describe("staff pages and the BFF are private", () => {
  test("/admin without a session redirects to sign-in with the pathname, with private headers", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toMatch(/\/admin\/login\?next=%2Fadmin$/);
    expectPrivateHeaders(response.headers(), "/admin redirect");
  });

  test("a query string never travels into the sign-in redirect", async ({ request }) => {
    const response = await request.get("/admin?search=private-name&x=1", { maxRedirects: 0 });
    expect(response.headers()["location"]).not.toContain("private-name");
    expect(response.headers()["location"]).toMatch(/next=%2Fadmin$/);
  });

  test("a signed-in /admin page is private, noindex and has the admin marker in its scripts", async ({ page, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    const seen = watchAssets(page);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    expectPrivateHeaders(response!.headers(), "/admin");
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
    await page.waitForLoadState("networkidle");
    expect(seen.some((asset) => asset.type === "script" && asset.body?.includes(MARKER)), "an admin script carries the marker").toBe(true);
    expect(seen.some((asset) => asset.type === "stylesheet" && asset.body?.includes("--color-night-")) || (await page.content()).includes("--color-night-"), "admin CSS is loaded").toBe(true);
  });

  for (const [method, path, expected] of [
    ["GET", "/api/admin/me", 401],
    ["GET", "/api/admin/not-allowed", 404],
    ["GET", "/api/admin/bookings/lowercase1", 404],
    ["POST", "/api/admin/staff", 403],
  ] as const) {
    test(`${method} ${path} answers ${expected} with private headers`, async ({ request }) => {
      const response = await request.fetch(path, { method, headers: method === "POST" ? { origin: "https://evil.example", "content-type": "application/json" } : {}, data: method === "POST" ? "{}" : undefined, maxRedirects: 0 });
      expect(response.status()).toBe(expected);
      expectPrivateHeaders(response.headers(), `${method} ${path}`);
    });
  }

  test("GET /api/admin/me with a session returns the viewer and never a token", async ({ request, context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
    const cookies = await context.cookies();
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const response = await request.get("/api/admin/me", { headers: { cookie } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ kind: "staff", role: "admin", timezone: "Asia/Karachi" });
    expect(JSON.stringify(body)).not.toMatch(/"token"/);
    expectPrivateHeaders(response.headers(), "me");
  });

  test("robots.txt and the sitemap keep the staff app out", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \//);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/admin");
  });
});
