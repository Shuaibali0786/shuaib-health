import type { Metadata } from "next";
import type { PageManifestEntry, SiteConfig } from "@/types/content";

const HTTPS = "https:";

/**
 * Base URL for canonical links, Open Graph and the sitemap, resolved in this order:
 *   1. SITE_URL (documented in frontend/.env.example);
 *   2. on Vercel, https://${VERCEL_PROJECT_PRODUCTION_URL} (production) or https://${VERCEL_URL} (preview);
 *   3. off Vercel (local, tests, CI), http://localhost:3000.
 * On Vercel the site never emits an http:// or localhost address: a production build with nothing to
 * resolve fails, and so does a SITE_URL that is not https or points at localhost.
 * This is the only place in src that reads the environment for the site address.
 */
export function siteUrl(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  const onVercel = vercelEnv === "production" || vercelEnv === "preview";
  const configured = process.env.SITE_URL?.trim();

  let base: string | undefined;
  if (configured) {
    base = configured;
  } else if (onVercel) {
    const host = (vercelEnv === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL)
      ?.trim()
      .replace(/^https?:\/\//, "");
    base = host ? `${HTTPS}//${host}` : undefined;
  } else {
    base = "http://localhost:3000";
  }

  if (!base) {
    throw new Error("SITE_URL is not set and Vercel provided no URL to use instead.");
  }
  base = base.replace(/\/+$/, "");
  if (onVercel && (!base.startsWith("https://") || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base))) {
    throw new Error("SITE_URL must be an https address that is not localhost on Vercel.");
  }
  return base;
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
