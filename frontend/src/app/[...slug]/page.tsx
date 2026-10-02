import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { findPlaceholderRoute, placeholderRoutes } from "@/lib/routes";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

/**
 * Serves "Coming soon" for every registered placeholder path (lib/routes.ts).
 * dynamicParams = false makes every other path a real 404 whose HTML is rendered on the server,
 * inside the site layout, so it also works without JavaScript and for crawlers.
 *
 * Known and harmless: Next logs "Error: Internal: NoFallbackError" on the server for each unknown
 * URL it answers this way. Dropping dynamicParams = false silences that line, but then Next serves
 * its generic error shell for unknown URLs (the 404 text only exists in the client payload), which
 * is worse. Verified in the browser and in tests/e2e/links.spec.ts.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return placeholderRoutes().map((route) => ({ slug: route.path.split("/").filter(Boolean) }));
}

async function resolve(params: PageProps["params"]) {
  const { slug } = await params;
  return findPlaceholderRoute(`/${slug.join("/")}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const route = await resolve(params);
  return {
    title: route ? `${route.title} — Coming soon` : "Page not found",
    robots: { index: false, follow: false },
  };
}

export default async function ComingSoonPage({ params }: PageProps) {
  const route = await resolve(params);
  if (!route) notFound();
  return <ComingSoon title={route.title} />;
}
