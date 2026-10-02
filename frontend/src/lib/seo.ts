import type { Metadata } from "next";
import { siteConfig } from "@/data/siteConfig";
import type { PageManifestEntry } from "@/types/content";

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
export function pageMetadata(entry: Pick<PageManifestEntry, "path" | "title" | "description">): Metadata {
  const fullTitle = `${entry.title} | ${siteConfig.name}`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: entry.path },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: fullTitle,
      description: entry.description,
      url: entry.path,
      locale: "en_PK",
    },
    twitter: { card: "summary_large_image", title: fullTitle, description: entry.description },
  };
}
