import { IconTile } from "@/components/ui/IconTile";
import type { AboutVisitStep } from "@/types/content";

/** The numbered "how a visit works" sequence. A real <ol>, so the numbers are announced as a list. */
export function VisitSteps({ steps }: { steps: AboutVisitStep[] }) {
  return (
    <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-4 rounded-card border border-border bg-white p-5 shadow-soft">
          <IconTile name={step.iconName} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-teal-700">Step {index + 1}</p>
            <h3 className="mt-0.5 text-lg font-bold">{step.title}</h3>
            <p className="mt-1 text-base text-muted">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
