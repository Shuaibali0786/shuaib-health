import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { LabTestFacts } from "@/components/lab-tests/LabTestFacts";
import { Button } from "@/components/ui/Button";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { labTests } from "@/data/labTests";
import { getDepartments, getLabTestBySlug, getLabTestCategories, getPackagesIncludingTest } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { departmentPath, labTestPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

/** Only the sample catalog exists; any other slug is the not-found page. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return labTests.map((test) => ({ slug: test.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lab-tests/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(getManifestEntry(labTestPath(slug)));
}

export default async function LabTestPage({ params }: PageProps<"/lab-tests/[slug]">) {
  const { slug } = await params;
  const test = await getLabTestBySlug(slug);
  if (!test) notFound();

  const [categories, departments, packages] = await Promise.all([
    getLabTestCategories(),
    getDepartments(),
    getPackagesIncludingTest(test.slug),
  ]);
  const category = categories.find((candidate) => candidate.id === test.categoryId);
  const related = departments.filter((department) => test.relatedDepartmentIds.includes(department.id));

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
