import type { Metadata } from "next";
import { DepartmentCard } from "@/components/home/DepartmentCard";
import { DEPARTMENT_ITEM, DEPARTMENT_LIST } from "@/components/home/department-grid";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig, loadDepartments } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.departments), await getSiteConfig());
}

/** The seven sample departments, in display order, with the same cards as Home. */
export default async function DepartmentsPage() {
  const { emergencyPhone: phone } = await getSiteConfig();
  const departments = await loadDepartments();

  return (
    <>
      <PageHeader
        trail={[{ label: "Departments" }]}
        title="Our departments"
        intro="Choose a department to see what it covers, its doctors and the lab tests that go with it."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample departments" />
          <span>Everything on these pages is sample content for the demo.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Departments">
        {departments.ok ? (
          <ul className={DEPARTMENT_LIST}>
            {departments.data.map((department) => (
              <li key={department.id} className={DEPARTMENT_ITEM}>
                <DepartmentCard department={department} />
              </li>
            ))}
          </ul>
        ) : (
          <DataUnavailable phone={phone} href={ROUTES.departments} />
        )}
      </Section>
    </>
  );
}
