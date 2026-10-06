import type { Metadata } from "next";
import { Suspense } from "react";
import { DoctorBrowser, DoctorBrowserFallback } from "@/components/doctors/DoctorBrowser";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataUnavailable } from "@/components/ui/DataUnavailable";
import { Section } from "@/components/ui/Section";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { getSiteConfig, loadDepartments, loadDoctors } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.doctors), await getSiteConfig());
}

/**
 * Doctors list. The server renders every doctor; the filter island (department, name, day) takes
 * over in the browser. The Suspense fallback is the same list, so it also works without JavaScript.
 */
export default async function DoctorsPage() {
  const { emergencyPhone: phone } = await getSiteConfig();
  const [doctors, departments] = await Promise.all([loadDoctors(), loadDepartments()]);
  const departmentOptions = (departments.ok ? departments.data : []).map(({ id, slug, name }) => ({ id, slug, name }));

  return (
    <>
      <PageHeader
        trail={[{ label: "Doctors" }]}
        title="Our doctors"
        intro="Find a doctor by department, name or the day they are available. All times are Asia/Karachi."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample profiles" />
          <span>These doctors, photos, fees and schedules are invented for the demo.</span>
        </p>
      </PageHeader>
      <Section tone="background" spacing="compact" aria-label="Doctors">
        {doctors.ok ? (
          <Suspense fallback={<DoctorBrowserFallback doctors={doctors.data} departments={departmentOptions} />}>
            <DoctorBrowser doctors={doctors.data} departments={departmentOptions} />
          </Suspense>
        ) : (
          <DataUnavailable phone={phone} href={ROUTES.doctors} />
        )}
      </Section>
    </>
  );
}
