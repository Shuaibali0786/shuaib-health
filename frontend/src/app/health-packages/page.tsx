import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { PackageCard } from "@/components/packages/PackageCard";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, loadHealthPackages, loadLabTests } from "@/lib/content";
import { summarizePackage } from "@/lib/packages";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.healthPackages));
}

/** Five sample packages. Every total is worked out from the lab test catalog, never typed in. */
export default async function HealthPackagesPage() {
  const { emergencyPhone: phone } = await getSiteConfig();
  const [packages, tests] = await Promise.all([loadHealthPackages(), loadLabTests()]);
  // Without the lab test catalog the package totals cannot be worked out; the packages still render
  // without their test names and sums, never a crash.

  return (
    <>
      <PageHeader
        trail={[{ label: "Health Packages" }]}
        title="Health packages"
        intro="Each package is a set of lab tests from our catalog. Open any test to see its details, and compare the package price with the tests added up."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample prices" />
          <span>All packages and prices are samples for the demo, in PKR.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Health packages">
        {packages.ok ? (
          <ul className="flex flex-wrap justify-center gap-6">
            {packages.data.map((pkg) => (
              <li key={pkg.id} className="flex w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]">
                <PackageCard pkg={pkg} summary={tests.ok ? summarizePackage(pkg, tests.data, { skipMissing: true }) : null} />
              </li>
            ))}
          </ul>
        ) : (
          <DataUnavailable phone={phone} href={ROUTES.healthPackages} />
        )}
      </Section>
    </>
  );
}
