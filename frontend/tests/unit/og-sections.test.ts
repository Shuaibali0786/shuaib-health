import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPageManifest } from "@/lib/pages";
import { fixtureCatalog } from "../fixtures/catalog";
import { siteConfig } from "../fixtures/catalog/siteConfig";

// pageMetadata() sets openGraph on every page, and Next replaces (does not merge) a parent's openGraph, so the
// site-wide card in (site)/opengraph-image.tsx never reaches a page that sets its own. Each static page therefore
// needs a card file in its own folder (found missing on the live site, 2026-11-07 audit).
const SITE = join(__dirname, "../../src/app/(site)");
const manifest = getPageManifest(fixtureCatalog, siteConfig.fullTitle);

describe("Open Graph cards (2026-11-07 audit)", () => {
  const staticPaths = manifest.filter((entry) => entry.kind === "static").map((entry) => entry.path);

  it("covers the listing pages", () => {
    expect(staticPaths).toEqual(expect.arrayContaining(["/", "/doctors", "/about", "/book-appointment", "/privacy"]));
  });

  // The nearest card above a page, not counting the site-wide one (which the page's own openGraph would drop).
  // Preset pages live in the dynamic [preset] folder and get the demo/specialties card.
  const nearestCard = (path: string): string | undefined => {
    if (path === "/") return join(SITE, "opengraph-image.tsx");
    const parts = path.split("/").filter(Boolean);
    for (let n = parts.length; n > 0; n--) {
      const file = join(SITE, ...parts.slice(0, n), "opengraph-image.tsx");
      if (existsSync(file)) return file;
    }
    return undefined;
  };

  it.each(staticPaths)("has its own (not inherited site-wide) opengraph-image for %s", (path) => {
    const file = nearestCard(path);
    expect(file, path).toBeDefined();
    if (!file) return;
    const code = readFileSync(file, "utf8");
    expect(code).toMatch(/export const size = OG_SIZE/);
    expect(code).toMatch(/export const contentType = "image\/png"/);
    expect(code).toMatch(/export const alt = "[^"]+"/);
  });
});
