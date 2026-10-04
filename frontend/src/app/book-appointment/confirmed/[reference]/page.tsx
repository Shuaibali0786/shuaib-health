import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ConfirmationCard } from "@/components/booking/ConfirmationCard";
import { BeforeYourVisit } from "@/components/contact/BeforeYourVisit";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/ui/Section";
import { ApiError } from "@/lib/api/http";
import { callBooking, clientIpFrom, type BackendResult } from "@/lib/booking/backend";
import { displayReference, parseReference } from "@/lib/booking/reference";
import { AppointmentViewSchema } from "@/lib/booking/schemas";
import { getClinicRules, getSiteConfig } from "@/lib/content";
import { ROUTES } from "@/lib/routes";

// A confirmation is private to whoever holds the link: never indexed, never sent as a referrer.
export const metadata: Metadata = {
  title: "Booking confirmation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const TRAIL = [{ label: "Book an appointment", href: ROUTES.bookAppointment }, { label: "Confirmation" }];

async function lookup(reference: string): Promise<BackendResult | null> {
  try {
    return await callBooking({
      method: "GET",
      path: `/appointments/${reference}`,
      clientIp: clientIpFrom(await headers()),
      requestId: crypto.randomUUID(),
      timeoutMs: 5000,
    });
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

export default async function ConfirmedPage({ params }: { params: Promise<{ reference: string }> }) {
  const reference = parseReference((await params).reference);
  if (!reference) notFound();

  const [site, rules, result] = await Promise.all([getSiteConfig(), getClinicRules(), lookup(reference)]);
  const view = result?.status === 200 ? AppointmentViewSchema.safeParse(result.body) : null;

  if (view?.success) {
    return (
      <>
        <PageHeader trail={TRAIL} title="Your appointment is booked" intro="Keep your reference. This page is private to you." />
        <Section tone="background" spacing="compact" aria-label="Booking details">
          <ConfirmationCard view={view.data} site={site} />
        </Section>
        <BeforeYourVisit rules={rules} />
      </>
    );
  }

  if (result?.status === 404) {
    return (
      <PageHeader trail={TRAIL} title="Booking not found" intro="We couldn't find a booking with that reference. Please check it and try again.">
        <a href={ROUTES.bookAppointment} className="font-semibold text-teal-700 underline underline-offset-2">
          Book an appointment
        </a>
      </PageHeader>
    );
  }

  return (
    <PageHeader
      trail={TRAIL}
      title="We can't show your booking right now"
      intro={`Your reference is ${displayReference(reference)}. Please try again in a few minutes${site.generalPhone.tel !== "" ? `, or call the clinic on ${site.generalPhone.display}` : ""}.`}
    />
  );
}
