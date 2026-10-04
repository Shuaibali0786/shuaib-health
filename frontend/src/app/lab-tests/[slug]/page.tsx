import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LabTestFacts } from "@/components/lab-tests/LabTestFacts";
import { Button } from "@/components/ui/Button";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, getLabTests, loadDepartments, loadHealthPackages, loadLabTestCategories, loadLabTests } from "@/lib/content";
import { labTestEntry } from "@/lib/pages";
import { departmentPath, labTestPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

/** Tests added after the build render on first request; a slug not in the list is the not-found page. */
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getLabTests()).map((test) => ({ slug: test.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lab-tests/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tests = await loadLabTests();
  const test = tests.ok ? tests.data.find((candidate) => candidate.slug === slug) : undefined;
  // An outage or an unknown slug gets a generic title; the page itself decides between the
  // friendly message and the not-found page.
  return test ? pageMetadata(labTestEntry(test)) : { title: "Lab test", alternates: { canonical: labTestPath(slug) } };
}

export default async function LabTestPage({ params }: PageProps<"/lab-tests/[slug]">) {
  const { emergencyPhone: phone } = await getSiteConfig();
  const { slug } = await params;
  const [tests, categories, departments, allPackages] = await Promise.all([
    loadLabTests(),
    loadLabTestCategories(),
    loadDepartments(),
    loadHealthPackages(),
  ]);
  if (!tests.ok) {
    return (
      <>
        <PageHeader trail={[{ label: "Lab Tests", href: ROUTES.labTests }, { label: "Lab test" }]} title="Lab test" />
        <Section tone="background" spacing="compact" aria-label="Lab test">
          <DataUnavailable phone={phone} href={labTestPath(slug)} />
        </Section>
      </>
    );
  }
  const test = tests.data.find((candidate) => candidate.slug === slug);
  if (!test) notFound();

  // The related sections degrade on their own: when their data is missing they are simply left out.
  const category = categories.ok ? categories.data.find((candidate) => candidate.id === test.categoryId) : undefined;
  const related = departments.ok ? departments.data.filter((department) => test.relatedDepartmentIds.includes(department.id)) : [];
  const packages = allPackages.ok ? allPackages.data.filter((pkg) => pkg.testSlugs.includes(test.slug)) : [];

  return (
    <>
      <PageHeader
        trail={[{ label: "Lab Tests", href: ROUTES.labTests }, { label: test.name }]}
        eyebrow={category?.name}
        title={test.name}
        intro={test.about}
      >
        <SampleBadge label="Sample test" />
      </PageHeader>

      <Section tone="background" spacing="compact" aria-label={`About ${test.name}`}>
        <div className="flex max-w-3xl flex-col gap-8">
          {test.alsoKnownAs.length > 0 ? (
            <p className="text-base text-ink">
              <span className="text-muted">Also known as:</span> {test.alsoKnownAs.join(", ")}
            </p>
          ) : null}

          <LabTestFacts test={test} category={category} />

          {packages.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold">Included in packages</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {packages.map((pkg) => (
                  <li key={pkg.id}>
                    <Link
                      href={ROUTES.healthPackages}
                      className="inline-flex min-h-11 items-center rounded-pill border-2 border-border-strong bg-white px-4 text-sm font-semibold text-teal-700 underline-offset-2 hover:bg-surface hover:underline"
                    >
                      {pkg.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {related.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold">Related departments</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {related.map((department) => (
                  <li key={department.id}>
                    <Link
                      href={departmentPath(department.slug)}
                      className="inline-flex min-h-11 items-center rounded-pill border-2 border-border-strong bg-white px-4 text-sm font-semibold text-teal-700 underline-offset-2 hover:bg-surface hover:underline"
                    >
                      {department.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <Button href={ROUTES.labTests} variant="outline">
              All lab tests
            </Button>
          </div>
          <p className="text-sm text-muted">This is a sample test with a sample price. Nothing here is a real lab service.</p>
        </div>
      </Section>
    </>
  );
}
