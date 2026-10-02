import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DepartmentSections } from "@/components/departments/DepartmentSections";
import { PageHeader } from "@/components/layout/PageHeader";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { departments } from "@/data/departments";
import { getDepartmentBySlug, getDoctorsByDepartment, getLabTestCategories, getLabTestsBySlugs } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { departmentPath, ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

/** Only the seven sample departments exist; any other slug is the not-found page. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return departments.map((department) => ({ slug: department.slug }));
}

export async function generateMetadata({ params }: PageProps<"/departments/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata(getManifestEntry(departmentPath(slug)));
}

export default async function DepartmentPage({ params }: PageProps<"/departments/[slug]">) {
  const { slug } = await params;
  const department = await getDepartmentBySlug(slug);
  if (!department) notFound();

  const [doctors, tests, categories] = await Promise.all([
    getDoctorsByDepartment(department.id),
    getLabTestsBySlugs(department.relatedTestSlugs),
    getLabTestCategories(),
  ]);

  return (
    <>
      <PageHeader
        trail={[{ label: "Departments", href: ROUTES.departments }, { label: department.name }]}
        title={department.name}
        intro={department.summary}
      >
        <SampleBadge label="Sample department" />
      </PageHeader>
      <DepartmentSections department={department} doctors={doctors} tests={tests} categories={categories} />
    </>
  );
}
