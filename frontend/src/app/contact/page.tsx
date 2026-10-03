import { Phone, Siren } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { MapEmbed } from "@/components/contact/MapEmbed";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { Section } from "@/components/ui/Section";
import { getSiteConfig } from "@/lib/content";
import { formatOpeningHours } from "@/lib/format";
import { getManifestEntry } from "@/lib/pages";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata(getManifestEntry(ROUTES.contact));
}

export default async function ContactPage() {
  const site = await getSiteConfig();

  return (
    <>
      <PageHeader
        trail={[{ label: "Contact" }]}
        title="Contact us"
        intro="Sample phone numbers, opening hours and a map of the general area, plus a message form that checks your text but does not send it."
      >
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <SampleBadge label="Sample details" />
          <span>Every detail on this page is invented for the demo.</span>
        </p>
      </PageHeader>

      <Section tone="background" spacing="compact" aria-label="Contact details and message form">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-8">
          <div aria-labelledby="contact-details-title" role="group">
            <h2 id="contact-details-title" className="text-2xl font-bold">
              Phone numbers and hours
            </h2>
            <div className="mt-6 flex flex-col gap-6">
              <Card className="flex flex-col gap-5 p-6">
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-muted">General enquiries (sample number)</p>
                    <a href={`tel:${site.generalPhone.tel}`} className="text-lg font-bold text-navy-900 underline underline-offset-2">
                      {site.generalPhone.display}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Siren className="mt-1 size-5 shrink-0 text-danger-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-muted">Emergency (sample number)</p>
                    <a href={`tel:${site.emergencyPhone.tel}`} className="text-lg font-bold text-danger-700 underline underline-offset-2">
                      {site.emergencyPhone.display}
                    </a>
                  </div>
                </div>
                <p className="text-sm text-muted">
                  These demo numbers do not connect to anyone. If you or someone else has a real emergency, contact your local emergency
                  services right away.
                </p>
              </Card>

              <div className="overflow-hidden rounded-card border border-border">
                <table className="w-full text-left text-base">
                  <caption className="bg-surface px-4 py-3 text-left text-sm font-semibold text-navy-900">
                    Opening hours (Asia/Karachi time, PKT). Sample hours.
                  </caption>
                  <thead>
                    <tr className="border-t border-border text-sm text-muted">
                      <th scope="col" className="px-4 py-2 font-semibold">
                        Service
                      </th>
                      <th scope="col" className="px-4 py-2 font-semibold">
                        Days and hours
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <th scope="row" className="px-4 py-3 font-semibold text-navy-900">
                        Clinic
                      </th>
                      <td className="px-4 py-3 text-ink">{formatOpeningHours(site.openingHours)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <th scope="row" className="px-4 py-3 font-semibold text-navy-900">
                        Lab
                      </th>
                      <td className="px-4 py-3 text-ink">{formatOpeningHours(site.labHours)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div aria-labelledby="contact-form-title" role="group">
            <h2 id="contact-form-title" className="text-2xl font-bold">
              Send us a message
            </h2>
            <p className="mt-2 text-base text-muted">
              This form checks your entries and then stops. Messages are not sent in this demo, and nothing you type is saved.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="surface" spacing="compact" labelledBy="contact-map-title">
        <h2 id="contact-map-title" className="text-2xl font-bold">
          Find us (sample address)
        </h2>
        <div className="mt-6 max-w-3xl">
          <MapEmbed />
        </div>
      </Section>
    </>
  );
}
