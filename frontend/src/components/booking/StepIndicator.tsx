import { FLOW_STEPS, type FlowStep } from "@/lib/booking/flowUrl";
import { STEP_LABEL } from "@/lib/booking/labels";
import { cn } from "@/lib/cn";

/** The five steps as an ordered list. The current one has `aria-current="step"`; done steps are marked in words too. */
export function StepIndicator({ current }: { current: FlowStep }) {
  const currentIndex = FLOW_STEPS.indexOf(current);
  return (
    <ol aria-label="Booking steps" className="flex flex-wrap gap-x-2 gap-y-2 text-sm">
      {FLOW_STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-pill border px-3 py-1 font-semibold",
              state === "current" && "border-navy-900 bg-navy-900 text-white",
              state === "done" && "border-teal-700 bg-teal-50 text-teal-700",
              state === "todo" && "border-border-strong bg-white text-muted",
            )}
          >
            <span aria-hidden="true">{index + 1}</span>
            <span>{STEP_LABEL[step]}</span>
            {state === "done" ? <span className="sr-only">(done)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
