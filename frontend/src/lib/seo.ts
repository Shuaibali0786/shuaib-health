import type { Metadata } from "next";
import type { PageManifestEntry, SiteConfig } from "@/types/content";

/**
 * Base URL for canonical links, Open Graph and the sitemap. Reads the optional public variable
 * SITE_URL (documented in frontend/.env.example). It has a default, so the build never needs it.
 * This is the only place in src that reads the environment.
 */
export function siteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

/**
 * Metadata for a manifest entry: title (the layout template appends the site name), description,
 * canonical path, and Open Graph / Twitter text. Robots stay as set by the root layout, and the
 * Open Graph image comes from the opengraph-image files next to the routes.
 */
export function pageMetadata(entry: Pick<PageManifestEntry, "path" | "title" | "description">, site: Pick<SiteConfig, "name">): Metadata {
  const fullTitle = `${entry.title} | ${site.name}`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: entry.path },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: fullTitle,
      description: entry.description,
      url: entry.path,
      locale: "en_PK",
    },
    twitter: { card: "summary_large_image", title: fullTitle, description: entry.description },
  };
}

/**
 * Organisation structured data for the home page: the clinic name and site address, plus the clinic's
 * logo when the data has one. Without a logo the logo field is simply left out.
 */
export function organizationJsonLd(site: Pick<SiteConfig, "name" | "logo">): Record<string, string> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: base,
    ...(site.logo ? { logo: `${base}${site.logo.src}` } : {}),
  };
}
