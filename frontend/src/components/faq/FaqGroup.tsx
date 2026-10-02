import { ChevronDown } from "lucide-react";
import type { FaqGroup } from "@/types/content";

/**
 * One FAQ group: a section addressable by its slug (/faq#home-sample-collection) with a native
 * <details><summary> per question. The browser supplies Enter/Space toggling and the expanded
 * state, and it works without JavaScript. The chevron only rotates when motion is allowed.
 */
export function FaqGroupSection({ group }: { group: FaqGroup }) {
  const headingId = `${group.slug}-heading`;
  return (
    <section id={group.slug} aria-labelledby={headingId} className="scroll-mt-24">
      <h2 id={headingId} className="text-2xl font-bold">
        {group.title}
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {group.items.map((item) => (
          <details key={item.id} className="group rounded-card border border-border bg-white shadow-soft">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-3 text-base font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                className="size-5 shrink-0 text-teal-700 group-open:rotate-180 motion-safe:transition-transform"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-4 text-base text-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
