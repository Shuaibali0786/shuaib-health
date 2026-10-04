import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TipBrowser, TipBrowserFallback } from "@/components/tips/TipBrowser";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getHealthTipCategories, getHealthTips, getSiteConfig } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.healthTips), await getSiteConfig());
}

/**
 * Health Tips list. The server renders every article card; the category filter takes over in the
 * browser. The Suspense fallback is the same list, so it also works without JavaScript.
 */
export default async function HealthTipsPage() {
  const [tips, categories] = await Promise.all([getHealthTips(), getHealthTipCategories()]);

  return (
    <>
      <PageHeader
        trail={[{ label: "Health Tips" }]}
        title="Health tips"
        intro="Short, plain-language articles on everyday habits: food, sleep, movement, hygiene and stress."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample articles" />
          <span>General information, not medical advice. These articles are samples written for the demo.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Health tip articles">
        <Suspense fallback={<TipBrowserFallback tips={tips} categories={categories} />}>
          <TipBrowser tips={tips} categories={categories} />
        </Suspense>
      </Section>
    </>
  );
}
