import type { Metadata } from "next";
import { Suspense } from "react";
import { LabTestBrowser, LabTestBrowserFallback } from "@/components/lab-tests/LabTestBrowser";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, loadLabTestCategories, loadLabTests } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.labTests));
}

/**
 * Lab test catalog. The server renders every test; the filter island (search, category) takes over
 * in the browser. The Suspense fallback is the same list, so it also works without JavaScript.
 */
export default async function LabTestsPage() {
  const { emergencyPhone: phone } = await getSiteConfig();
  const [tests, categories] = await Promise.all([loadLabTests(), loadLabTestCategories()]);

  return (
    <>
      <PageHeader
        trail={[{ label: "Lab Tests" }]}
        title="Lab tests"
        intro="Search by test name or pick a category. Each test shows its sample type, report time and how to prepare."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample prices" />
          <span>All prices are sample prices for the demo, in PKR.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Lab tests">
        {tests.ok && categories.ok ? (
          <Suspense fallback={<LabTestBrowserFallback tests={tests.data} categories={categories.data} />}>
            <LabTestBrowser tests={tests.data} categories={categories.data} />
          </Suspense>
        ) : (
          <DataUnavailable phone={phone} href={ROUTES.labTests} />
        )}
      </Section>
    </>
  );
}
