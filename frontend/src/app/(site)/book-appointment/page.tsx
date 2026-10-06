import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { BookingUnavailable } from "@/components/booking/BookingUnavailable";
import { BeforeYourVisit } from "@/components/contact/BeforeYourVisit";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/ui/Section";
import { getClinicRules, getSiteConfig, loadDepartments, loadDoctors } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.bookAppointment), await getSiteConfig());
}

/**
 * Book an appointment. The page renders from the cached catalog; the times and the booking itself
 * are fetched in the browser, so a sleeping API never blocks the page or the build.
 */
export default async function BookAppointmentPage() {
  const [site, rules, departments, doctors] = await Promise.all([getSiteConfig(), getClinicRules(), loadDepartments(), loadDoctors()]);

  return (
    <>
      <PageHeader
        trail={[{ label: "Book an appointment" }]}
        title="Book an appointment"
        intro="Choose a department, a doctor and a time. All times are Asia/Karachi. This is a portfolio demo: nobody will contact you."
      />
      <Section tone="background" spacing="compact" aria-label="Booking">
        {departments.ok && doctors.ok ? (
          <Suspense
            fallback={
              // Reserves about the height of the first step, so the rules below don't jump when the flow appears (CLS).
              <p role="status" className="min-h-[59rem] lg:min-h-[31.5rem]">
                Loading the booking steps…
              </p>
            }
          >
            <BookingFlow departments={departments.data} doctors={doctors.data} clinicPhone={site.generalPhone} timeZone={site.timeZone} />
          </Suspense>
        ) : (
          <BookingUnavailable phone={site.generalPhone} />
        )}
      </Section>
      <div id="clinic-rules">
        <BeforeYourVisit rules={rules} />
      </div>
    </>
  );
}
