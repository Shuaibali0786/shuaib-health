import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DepartmentSections } from "@/components/departments/DepartmentSections";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, getDepartments, loadDepartments, loadDoctors, loadLabTestCategories, loadLabTests } from "@/lib/content";
import { departmentEntry } from "@/lib/pages";
import { departmentPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

/** Departments added after the build render on first request; a slug not in the list is the not-found page. */
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getDepartments()).map((department) => ({ slug: department.slug }));
}

export async function generateMetadata({ params }: PageProps<"/departments/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const departments = await loadDepartments();
  const department = departments.ok ? departments.data.find((candidate) => candidate.slug === slug) : undefined;
  // An outage or an unknown slug gets a generic title; the page itself decides between the
  // friendly message and the not-found page.
  return department ? pageMetadata(departmentEntry(department), await getSiteConfig()) : { title: "Department", alternates: { canonical: departmentPath(slug) } };
}

export default async function DepartmentPage({ params }: PageProps<"/departments/[slug]">) {
  const { emergencyPhone: phone } = await getSiteConfig();
  const { slug } = await params;
  const [departments, doctors, tests, categories] = await Promise.all([
    loadDepartments(),
    loadDoctors(),
    loadLabTests(),
    loadLabTestCategories(),
  ]);
  if (!departments.ok) {
    return (
      <>
        <PageHeader trail={[{ label: "Departments", href: ROUTES.departments }, { label: "Department" }]} title="Department" />
        <Section tone="background" spacing="compact" aria-label="Department">
          <DataUnavailable phone={phone} href={departmentPath(slug)} />
        </Section>
      </>
    );
  }
  const department = departments.data.find((candidate) => candidate.slug === slug);
  if (!department) notFound();

  // Each related resource degrades on its own: the page keeps its other sections.
  const departmentDoctors = doctors.ok ? doctors.data.filter((doctor) => doctor.departmentId === department.id) : null;
  const relatedTests = tests.ok
    ? department.relatedTestSlugs.flatMap((testSlug) => tests.data.filter((test) => test.slug === testSlug))
    : null;

  return (
    <>
      <PageHeader
        trail={[{ label: "Departments", href: ROUTES.departments }, { label: department.name }]}
        title={department.name}
        intro={department.summary}
      >
        <SampleBadge label="Sample department" />
      </PageHeader>
      <DepartmentSections
        department={department}
        doctors={departmentDoctors}
        tests={relatedTests}
        categories={categories.ok ? categories.data : []}
        phone={phone}
      />
    </>
  );
}
