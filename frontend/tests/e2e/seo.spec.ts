import { expect, test } from "@playwright/test";
import { getPageManifest } from "../../src/lib/pages";

const manifest = getPageManifest();

test.describe("seo", () => {
  test("sitemap.xml lists every manifest page except booking", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]!).pathname);
    const expected = manifest.filter((entry) => entry.inSitemap).map((entry) => entry.path);
    expect([...locations].sort()).toEqual([...expected].sort());
    expect(locations).not.toContain("/book-appointment");
  });

  test("robots.txt disallows everything while the site is not indexable, and the meta tag agrees", async ({ request, page }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/User-Agent: \*/i);
    expect(robots).toMatch(/Disallow: \//);
    await page.goto("/");
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  });

  test("generated Open Graph images return a PNG", async ({ page, request }) => {
    for (const path of ["/", "/health-tips/staying-hydrated"]) {
      await page.goto(path);
      const url = await page.locator("meta[property='og:image']").first().getAttribute("content");
      expect(url, path).toBeTruthy();
      const image = await request.get(new URL(url!).pathname);
      expect(image.status(), url!).toBe(200);
      expect(image.headers()["content-type"]).toContain("image/png");
    }
  });
});
