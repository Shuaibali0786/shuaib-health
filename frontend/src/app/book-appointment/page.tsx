import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.bookAppointment));
}

/** Holding page: booking is not built in the demo yet. Doctor and department pages link here. */
export default function BookAppointmentPage() {
  return (
    <ComingSoon
      title="Book appointment"
      heading="Booking coming soon"
      message="Online booking is not available in this demo yet. No details are collected. You can still look at our sample doctors and their weekly schedules."
      secondary={{ label: "Find a doctor", href: ROUTES.doctors }}
    />
  );
}
