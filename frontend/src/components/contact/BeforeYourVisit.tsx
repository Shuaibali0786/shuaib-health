import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { ClinicRule } from "@/types/content";

/**
 * "Before your visit": the clinic's rules, in the order the clinic set (the API sorts them). Shown on
 * Contact and Book Appointment. Renders nothing when there are no rules, so a clinic without rules,
 * or an outage, leaves no empty heading behind.
 */
export function BeforeYourVisit({ rules }: { rules: ClinicRule[] }) {
  if (rules.length === 0) return null;
  return (
    <Section tone="surface" spacing="compact" labelledBy="before-your-visit-title">
      <SectionHeading id="before-your-visit-title" title="Before your visit" />
      <ol className="mt-6 grid gap-5 md:grid-cols-2">
        {rules.map((rule, index) => (
          <li key={rule.id} className="flex gap-4 rounded-card border border-border bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold text-teal-700">
              <span className="sr-only">Rule </span>
              {index + 1}
            </p>
            <p className="min-w-0 text-base text-ink">{rule.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
