import type { Metadata } from "next";
import { DepartmentCard } from "@/components/home/DepartmentCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getDepartments } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.departments));
}

/** The seven sample departments, in display order, with the same cards as Home. */
export default async function DepartmentsPage() {
  const departments = await getDepartments();

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
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {departments.map((department) => (
            <li key={department.id} className="flex">
              <DepartmentCard department={department} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
