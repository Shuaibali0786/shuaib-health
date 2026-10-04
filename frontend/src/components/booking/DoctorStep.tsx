import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatPkr } from "@/lib/format";
import type { Doctor } from "@/types/content";

/** Doctors of one department, each with the "Sample" label and the consultation fee. */
export function DoctorStep({ doctors, onSelect }: { doctors: Doctor[]; onSelect: (slug: string) => void }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {doctors.map((doctor) => (
        <li key={doctor.id} className="flex">
          <article className="flex w-full flex-row gap-4 rounded-card border border-border bg-white p-4 shadow-soft">
            <div className="w-20 shrink-0 self-start overflow-hidden rounded-control sm:w-24">
              <ImageWithFallback image={doctor.photo} sizes="96px" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              {doctor.isSample ? <SampleBadge className="mb-2 self-start" /> : null}
              <h3 className="text-lg font-bold text-navy-900">{doctor.fullName}</h3>
              <p className="text-base font-semibold text-teal-700">{doctor.specialty}</p>
              <p className="mt-2 text-sm text-muted">
                Consultation fee <span className="ml-1 text-base font-bold text-navy-900">{formatPkr(doctor.feePkr)}</span>
              </p>
              <button
                type="button"
                aria-label={`Select ${doctor.fullName}`}
                onClick={() => onSelect(doctor.slug)}
                className="mt-3 inline-flex min-h-11 items-center justify-center self-start rounded-control bg-navy-900 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-navy-800"
              >
                Select
              </button>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
