import type { Metadata } from "next";
import { BeforeYourVisit } from "@/components/contact/BeforeYourVisit";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { getClinicRules, getSiteConfig } from "@/lib/content";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(getManifestEntry(ROUTES.bookAppointment), await getSiteConfig());
}

/** Holding page: booking is not built in the demo yet. Doctor and department pages link here. */
export default async function BookAppointmentPage() {
  const rules = await getClinicRules();
  return (
    <>
      <ComingSoon
        title="Book appointment"
        heading="Booking coming soon"
        message="Online booking is not available in this demo yet. No details are collected. You can still look at our sample doctors and their weekly schedules."
        secondary={{ label: "Find a doctor", href: ROUTES.doctors }}
      />
      <BeforeYourVisit rules={rules} />
    </>
  );
}
