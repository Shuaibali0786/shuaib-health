import { Section } from "@/components/ui/Section";
import { buildFacts } from "@/data/homeContent";

/**
 * Honest facts band (FR-014): four statements that are true within the demo. There are
 * no patient counts, years, awards, certifications or ratings, on purpose.
 * Values are teal-300 on navy (10.4:1), labels white (15.4:1). `departmentCount` comes from the
 * catalog API; without it a fact that needs no data takes its place.
 */
export function FactsBand({ departmentCount }: { departmentCount?: number }) {
  const facts = buildFacts(departmentCount);
  return (
    <Section
      labelledBy="facts-title"
      tone="none"
      spacing="compact"
      className="on-dark bg-deep-gradient"
    >
      <h2 id="facts-title" className="sr-only">
        At a glance
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 text-center lg:grid-cols-4">
        {facts.map((fact) => (
          <li key={fact.id}>
            <p className="font-heading text-3xl font-extrabold text-teal-300 lg:text-4xl">{fact.value}</p>
            <p className="mt-1 text-base text-white">{fact.label}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
