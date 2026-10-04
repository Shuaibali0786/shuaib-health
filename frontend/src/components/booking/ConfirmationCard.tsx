import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatLocalDate, timeZoneLabel } from "@/lib/booking/labels";
import type { AppointmentView } from "@/lib/booking/schemas";
import { formatPkr } from "@/lib/format";
import type { SiteConfig } from "@/types/content";

/** The masked confirmation. The full name, mobile number, email and reason are never shown again. */
export function ConfirmationCard({ view, site }: { view: AppointmentView; site: Pick<SiteConfig, "address" | "generalPhone"> }) {
  return (
    <article aria-labelledby="confirmation-reference-label" className="max-w-2xl rounded-card border border-border bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <p id="confirmation-reference-label" className="text-sm font-semibold uppercase tracking-[0.08em] text-teal-700">
          Booking reference
        </p>
        {view.isSample ? <SampleBadge label="Demo booking" /> : null}
      </div>
      <p className="mt-1 break-all font-mono text-3xl font-bold text-navy-900">{view.reference}</p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-base">
        <dt className="text-muted">Patient</dt>
        <dd className="font-semibold">{view.patientNameMasked}</dd>
        <dt className="text-muted">Mobile</dt>
        <dd className="font-semibold">{view.mobileMasked}</dd>
        <dt className="text-muted">Doctor</dt>
        <dd>
          <span className="font-semibold">{view.doctor.fullName}</span>
          <span className="block text-sm text-muted">{view.doctor.specialty}</span>
        </dd>
        <dt className="text-muted">Department</dt>
        <dd>{view.department.name}</dd>
        <dt className="text-muted">Date</dt>
        <dd className="font-semibold">{formatLocalDate(view.localDate)}</dd>
        <dt className="text-muted">Time</dt>
        <dd>
          <span className="font-semibold">{view.localTime}</span>{" "}
          <span className="text-sm text-muted">({timeZoneLabel(view.timeZone, new Date(view.startsAt))})</span>
        </dd>
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

      <p className="mt-6 rounded-control border border-teal-700 bg-teal-50 px-4 py-3 text-base text-navy-900">
        This is a demo booking. No one will contact you.
      </p>
    </article>
  );
}
