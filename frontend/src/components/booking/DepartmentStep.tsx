import { ChevronRight } from "lucide-react";
import type { Department } from "@/types/content";

/** Every department is offered, including one with no bookable doctors: the next step says what to do then. */
export function DepartmentStep({ departments, onSelect }: { departments: Department[]; onSelect: (slug: string) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {departments.map((department) => (
        <li key={department.id} className="flex">
          <button
            type="button"
            onClick={() => onSelect(department.slug)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-border bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className="min-w-0">
              <span className="block text-lg font-bold text-navy-900">{department.name}</span>
              <span className="mt-0.5 block text-sm text-muted">{department.summary}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-teal-700" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
