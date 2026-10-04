import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/content";
import { siteUrl } from "@/lib/seo";

export const revalidate = 300;

/**
 * While the site is a demo (the clinic's `indexable` is false) crawlers are asked to stay out of
 * everything. The sitemap is still listed so flipping the flag later needs no other change.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { indexable } = await getSiteConfig();
  return {
    rules: indexable ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
