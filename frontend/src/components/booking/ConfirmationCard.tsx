import { ConfirmedSeal } from "@/components/booking/ConfirmedSeal";
import { LogoMark } from "@/components/brand/LogoMark";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { arriveByTime, formatLocalDateWithYear, timeZoneLabel } from "@/lib/booking/labels";
import { qrModules, qrPath } from "@/lib/booking/qr";
import type { AppointmentView } from "@/lib/booking/schemas";
import { ARRIVE_EARLY_MINUTES, SLIP_BRING, SLIP_DEMO_FOOTER, formatBookedOn, zoneLabel } from "@/lib/booking/slip";
import { formatPkr } from "@/lib/format";
import type { SiteConfig } from "@/types/content";

const QUIET = 2;

/** The QR code for the booking reference, and nothing else. Drawn as one path, so it prints crisply. */
function ReferenceQr({ reference }: { reference: string }) {
  const modules = qrModules(reference);
  const size = modules.length + 2 * QUIET;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for booking reference ${reference}`} className="size-24 bg-white" shapeRendering="crispEdges">
      <path d={qrPath(modules, QUIET)} className="fill-navy-900" />
    </svg>
  );
}

function GoldLabel({ children }: { children: string }) {
  return <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold-700">{children}</p>;
}

type SlipSite = Pick<SiteConfig, "name" | "address" | "generalPhone" | "emergencyPhone">;

/**
 * The luxury appointment slip (FR-057a): the same design as the downloaded PDF. It shows the masked
 * confirmation only; the full name, mobile number, email and reason are never shown again.
 */
export function ConfirmationCard({ view, site }: { view: AppointmentView; site: SlipSite }) {
  const zone = zoneLabel(view.timeZone);
  const emergency = site.emergencyPhone;
  return (
    <article
      aria-labelledby="confirmation-reference-label"
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-card border border-gold-500 bg-white shadow-soft print:shadow-none lg:mx-0"
    >
      {/* Watermark: faint, and anchored in the bottom corner so it never sits behind the visit details. */}
      <LogoMark size={200} className="pointer-events-none absolute -bottom-16 -right-12 opacity-[0.04]" />

      <header className="relative flex items-center gap-4 border-b-2 border-gold-500 bg-navy-900 px-6 py-5">
        <LogoMark size={44} tone="night" />
        <div className="min-w-0">
          <p className="font-heading text-xl font-bold leading-tight text-white">{site.name}</p>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-teal-300">Appointment slip</p>
        </div>
      </header>

      <div className="relative space-y-5 px-6 pb-6 pt-5">
        <section aria-label="Your appointment" className="rounded-control border border-gold-500 bg-teal-50 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div>
              <GoldLabel>Your appointment</GoldLabel>
              <p className="mt-1 font-heading text-xl font-bold leading-snug text-navy-900 sm:text-2xl">{formatLocalDateWithYear(view.localDate)}</p>
              <p className="mt-1 font-heading text-lg font-bold text-teal-700">
                {view.localTime} <span className="text-base">({zone})</span>
              </p>
              <p className="text-xs text-muted">{timeZoneLabel(view.timeZone, new Date(view.startsAt))}</p>
            </div>
            <ConfirmedSeal clinicName={site.name} bookedAt={view.bookedAt} timeZone={view.timeZone} sample={view.isSample} className="size-28 shrink-0 sm:size-32" />
          </div>
          <p className="mt-3 rounded-control bg-navy-900 px-3 py-2 text-sm font-semibold text-white">
            Please arrive by <span className="text-teal-300">{arriveByTime(view.localTime)}</span>
          </p>
        </section>

        <section aria-label="Visit details">
          <GoldLabel>Visit details</GoldLabel>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-border pt-3 text-base">
            <dt className="text-muted">Patient</dt>
            <dd className="font-semibold">{view.patientNameMasked}</dd>
            <dt className="text-muted">Mobile</dt>
            <dd className="font-semibold">{view.mobileMasked}</dd>
            <dt className="text-muted">Doctor</dt>
            <dd>
              <span className="font-semibold">{view.doctor.fullName}</span>
              {view.isSample ? <SampleBadge className="ml-2" /> : null}
              <span className="block text-sm text-muted">{view.doctor.specialty}</span>
            </dd>
            <dt className="text-muted">Department</dt>
            <dd>{view.department.name}</dd>
            <dt className="text-muted">Fee</dt>
            <dd>{formatPkr(view.feePkr)} (sample)</dd>
            {site.address.length > 0 ? (
              <>
                <dt className="text-muted">Clinic</dt>
                <dd>
                  {site.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  {site.generalPhone.tel !== "" ? (
                    <a href={`tel:${site.generalPhone.tel}`} className="font-semibold text-teal-700 underline underline-offset-2">
                      {site.generalPhone.display}
                    </a>
                  ) : null}
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="before-you-come-title" className="rounded-control border border-gold-500 p-4">
          <h2 id="before-you-come-title" className="font-heading text-base font-bold text-navy-900">
            Before you come
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base marker:text-teal-700">
            <li>Arrive {ARRIVE_EARLY_MINUTES} minutes early.</li>
            <li>{SLIP_BRING}</li>
            {emergency.tel !== "" ? (
              <li>
                Emergency? Call{" "}
                <a href={`tel:${emergency.tel}`} className="font-bold text-danger-700 underline underline-offset-2">
                  {emergency.display}
                </a>
                .
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {/* Ticket-style perforation: a dashed rule with a notch cut into each edge. */}
      <div aria-hidden="true" className="relative h-0 border-t-2 border-dashed border-gold-500">
        <span className="absolute -left-3 -top-3 size-6 rounded-full border border-gold-500 bg-background" />
        <span className="absolute -right-3 -top-3 size-6 rounded-full border border-gold-500 bg-background" />
      </div>

      <div className="relative flex items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <p id="confirmation-reference-label" className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold-700">
            Booking reference
          </p>
          <p className="mt-1 break-all font-heading text-2xl font-bold tracking-wider text-navy-900 sm:text-3xl">{view.reference}</p>
        </div>
        <figure className="shrink-0 text-center">
          <div className="rounded-control border border-border bg-white p-1">
            <ReferenceQr reference={view.reference} />
          </div>
          <figcaption className="mt-1 text-xs font-semibold text-navy-900">Show at reception</figcaption>
        </figure>
      </div>

      <footer className="relative border-t border-border px-6 py-4 text-sm text-muted">
        <p>Booked on {formatBookedOn(view.bookedAt, view.timeZone)}</p>
        <p>{SLIP_DEMO_FOOTER}</p>
      </footer>
    </article>
  );
}
