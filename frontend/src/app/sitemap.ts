import type { MetadataRoute } from "next";
import { getPageManifest } from "@/lib/pages";
import { siteUrl } from "@/lib/seo";

/** One entry per public page in the manifest, except holding pages (inSitemap: false). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return getPageManifest()
    .filter((entry) => entry.inSitemap)
    .map((entry) => ({ url: entry.path === "/" ? base : `${base}${entry.path}` }));
}
