import { expect, test } from "@playwright/test";

// The main test server sets SITE_URL to an https address (playwright.config.ts), so any self-link that
// falls back to localhost or to plain http would show up here.
const PAGES = ["/", "/doctors", "/doctors/dr-ayesha-rahman", "/lab-tests"];

test.describe("no localhost or http self-links", () => {
  for (const path of PAGES) {
    test(`canonical and og:url on ${path}`, async ({ page }) => {
      await page.goto(path);
      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(canonical, path).toBeTruthy();
      // og:url is only emitted on pages that set Open Graph metadata (not the home page); when present it must be clean too.
      const ogUrls = await page.locator("meta[property='og:url'], meta[property='og:image']").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("content") ?? ""),
      );
      for (const value of [canonical, ...ogUrls]) {
        expect(value).toMatch(/^https:\/\//);
        expect(value).not.toMatch(/localhost|127\.0\.0\.1/);
      }
    });
  }

  test("sitemap.xml has only https links", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(location).toMatch(/^https:\/\//);
      expect(location).not.toMatch(/localhost|127\.0\.0\.1/);
    }
  });

  test("robots.txt disallows everything while indexable=false, and its sitemap link is https", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \//);
    expect(robots).not.toMatch(/Allow: \//);
    const sitemapLine = robots.match(/Sitemap: (\S+)/i)?.[1];
    expect(sitemapLine).toMatch(/^https:\/\//);
    expect(robots).not.toMatch(/localhost|127\.0\.0\.1/);
  });
});
