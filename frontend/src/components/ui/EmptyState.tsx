import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** For example "No doctors match your filters". */
  title: string;
  description?: string;
  /** Shows a "Clear filters" button when given. */
  onClear?: () => void;
  clearLabel?: string;
  /** Extra content under the description, for example links. */
  children?: ReactNode;
}

/** Shown when a filtered list has no results. Never a blank area. */
export function EmptyState({ title, description, onClear, clearLabel = "Clear filters", children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-card border border-border bg-surface px-6 py-12 text-center">
      <SearchX className="size-10 text-muted" aria-hidden="true" />
      <p className="mt-4 text-xl font-bold text-navy-900">{title}</p>
      {description ? <p className="mt-2 max-w-md text-base text-muted">{description}</p> : null}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface"
        >
          {clearLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}
