import { Bot, Building2, CalendarClock, FlaskConical, Stethoscope } from "lucide-react";

export type TrustCounts = { doctors?: number; departments?: number; labTests?: number };

/**
 * A quiet trust strip under the hero text (owner 2026-11-15). The three counts are the REAL lengths of the demo data the
 * site is showing (the Hero reads them with the same cached loaders the other pages use); a count whose data did not
 * load is left out rather than guessed. "Sample data" says what they are. The AI receptionist is mentioned only when it
 * is really on (`ai`).
 */
export function TrustStrip({ counts, ai }: { counts: TrustCounts; ai: boolean }) {
  const shown = [
    counts.doctors === undefined ? null : { id: "doctors", Icon: Stethoscope, text: `${counts.doctors} doctors` },
    counts.departments === undefined ? null : { id: "departments", Icon: Building2, text: `${counts.departments} departments` },
    counts.labTests === undefined ? null : { id: "lab-tests", Icon: FlaskConical, text: `${counts.labTests} lab tests` },
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const items = [
    ...shown,
    { id: "booking", Icon: CalendarClock, text: "24/7 online booking" },
    ...(ai ? [{ id: "ai", Icon: Bot, text: "AI receptionist in English and Urdu" }] : []),
  ];
  return (
    <div data-testid="trust-strip" className="mt-7 max-w-xl">
      <ul aria-label="Highlights" className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm font-medium text-navy-900">
        {items.map(({ id, Icon, text }) => (
          <li key={id} className="inline-flex items-center gap-1.5">
            <Icon className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
      {shown.length > 0 ? <p className="mt-2 text-xs text-muted">Counts are from this demo&rsquo;s sample data.</p> : null}
    </div>
  );
}
