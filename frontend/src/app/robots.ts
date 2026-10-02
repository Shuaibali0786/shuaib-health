import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/siteConfig";
import { siteUrl } from "@/lib/seo";

/**
 * While the site is a demo (`siteConfig.indexable` is false) crawlers are asked to stay out of
 * everything. The sitemap is still listed so flipping the flag later needs no other change.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: siteConfig.indexable ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
