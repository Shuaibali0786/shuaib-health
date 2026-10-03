import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { healthTips } from "@/data/healthTips";
import { labTests } from "@/data/labTests";
import { siteConfig } from "@/data/siteConfig";
import { getManifestEntry, getPageManifest, knownPaths } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata, siteUrl } from "@/lib/seo";

const manifest = getPageManifest();

describe("page manifest (FR-005, FR-008)", () => {
  it("has unique paths, titles and descriptions", () => {
    expect(new Set(manifest.map((entry) => entry.path)).size).toBe(manifest.length);
    expect(new Set(manifest.map((entry) => entry.title)).size).toBe(manifest.length);
    expect(new Set(manifest.map((entry) => entry.description)).size).toBe(manifest.length);
  });

  it("has paths that start with / and never end with one, and short titles", () => {
    for (const entry of manifest) {
      expect(entry.path.startsWith("/")).toBe(true);
      if (entry.path !== "/") expect(entry.path.endsWith("/")).toBe(false);
      expect(entry.title.length, entry.path).toBeGreaterThan(2);
      expect(entry.title.length, entry.path).toBeLessThanOrEqual(75);
    }
  });

  it("has descriptions of 50 to 160 characters", () => {
    for (const entry of manifest) {
      expect(entry.description.length, entry.path).toBeGreaterThanOrEqual(50);
      expect(entry.description.length, entry.path).toBeLessThanOrEqual(160);
    }
  });

  it("covers every static route and every real page that exists", () => {
    const paths = manifest.map((entry) => entry.path);
    for (const path of Object.values(ROUTES)) expect(paths, path).toContain(path);
    for (const path of knownPaths()) expect(paths, path).toContain(path);
  });

  it("has every route family: 9 doctors, 7 departments, all lab tests and all tips", () => {
    const count = (kind: string) => manifest.filter((entry) => entry.kind === kind).length;
    expect(count("doctor")).toBe(9);
    expect(count("department")).toBe(7);
    expect(count("lab-test")).toBe(labTests.length);
    expect(count("tip")).toBe(healthTips.length);
  });

  it("throws for a path with no entry, so a missing entry fails loudly", () => {
    expect(() => getManifestEntry("/nope")).toThrow();
    expect(getManifestEntry("/doctors").title).toBe("Doctors");
  });
});

describe("pageMetadata", () => {
  it("builds the title, description, canonical path and share text from an entry", () => {
    const meta = pageMetadata(getManifestEntry("/doctors"));
    expect(meta.title).toBe("Doctors");
    expect(meta.alternates?.canonical).toBe("/doctors");
    expect(meta.openGraph?.title).toBe("Doctors | Shuaib Health");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("falls back to localhost when SITE_URL is not set, and strips a trailing slash", () => {
    const previous = process.env.SITE_URL;
    delete process.env.SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
    process.env.SITE_URL = "https://example.test/";
    expect(siteUrl()).toBe("https://example.test");
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  });
});

describe("sitemap and robots", () => {
  it("lists exactly the manifest pages marked for the sitemap, as absolute URLs", () => {
    const urls = sitemap().map((entry) => entry.url);
    const expected = manifest.filter((entry) => entry.inSitemap).map((entry) => (entry.path === "/" ? siteUrl() : `${siteUrl()}${entry.path}`));
    expect(urls).toEqual(expected);
    expect(urls).not.toContain(`${siteUrl()}/book-appointment`);
    for (const url of urls) expect(url.startsWith("http")).toBe(true);
  });

  it("asks crawlers to stay out while the site is not indexable, and still lists the sitemap", () => {
    expect(siteConfig.indexable).toBe(false);
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(result.sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});
