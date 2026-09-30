import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { findPlaceholderRoute, placeholderRoutes } from "@/lib/routes";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

/**
 * Serves "Coming soon" for every registered placeholder path (lib/routes.ts).
 * dynamicParams = false makes every other path a real 404.
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
