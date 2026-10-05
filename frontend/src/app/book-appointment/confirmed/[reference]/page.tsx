import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ConfirmationActions } from "@/components/booking/ConfirmationActions";
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
          <p className="mb-5 rounded-control border border-teal-700 bg-teal-50 px-4 py-3 text-base font-semibold text-navy-900 print:hidden">
            Save this slip: tap Download or take a screenshot. Show this reference at the clinic.
          </p>
          {/* Mobile: card, Download (sticky), other actions. Desktop: card left, actions right. */}
          {/* The bottom padding keeps the sticky mobile Download button from hiding the last rows. */}
          <div className="flex flex-col gap-5 pb-28 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-5 lg:gap-y-3 lg:pb-0">
            <div className="lg:row-span-2">
              <ConfirmationCard view={view.data} site={site} />
            </div>
            <ConfirmationActions
              view={view.data}
              clinic={{ name: site.name, address: site.address, phoneDisplay: site.generalPhone.display, phoneTel: site.generalPhone.tel, emergencyDisplay: site.emergencyPhone.display }}
            />
          </div>
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
