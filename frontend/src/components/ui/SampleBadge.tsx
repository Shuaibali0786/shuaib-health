import { cn } from "@/lib/cn";

/**
 * Marks sample content (constitution I). The word is always present, never colour alone.
 * teal-700 on teal-50 is 5.25:1. `label` lets a page say "Sample profile" or "Sample price".
 */
export function SampleBadge({ className, label = "Sample" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border border-teal-700 bg-teal-50 px-2.5 py-0.5 text-sm font-semibold text-teal-700",
        className,
      )}
    >
      {label}
    </span>
  );
}
