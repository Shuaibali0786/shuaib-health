import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { PackageCard } from "@/components/packages/PackageCard";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getHealthPackages, getLabTests } from "@/lib/content";
import { summarizePackage } from "@/lib/packages";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.healthPackages));
}

/** Five sample packages. Every total is worked out from the lab test catalog, never typed in. */
export default async function HealthPackagesPage() {
  const [packages, catalog] = await Promise.all([getHealthPackages(), getLabTests()]);

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
        <ul className="grid gap-6 lg:grid-cols-2">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex">
              <PackageCard pkg={pkg} summary={summarizePackage(pkg, catalog)} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
