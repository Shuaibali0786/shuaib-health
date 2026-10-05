import type { MetadataRoute } from "next";
import { getDepartments, getDoctors, getLabTests } from "@/lib/content";
import { getPageManifest } from "@/lib/pages";
import { siteUrl } from "@/lib/seo";

export const revalidate = 300;

/**
 * One entry per public page in the manifest, except pages marked inSitemap: false. When the
 * catalog API is unavailable the doctor, department and lab test pages are left out, so the
 * sitemap still lists the static and editorial pages and never throws.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [doctors, departments, labTests] = await Promise.all([getDoctors(), getDepartments(), getLabTests()]);
  return getPageManifest({ doctors, departments, labTests })
    .filter((entry) => entry.inSitemap)
    .map((entry) => ({ url: entry.path === "/" ? base : `${base}${entry.path}` }));
}
