import { cn } from "@/lib/cn";
import type { IconName } from "@/types/content";
import { ICONS } from "./icons";

interface IconTileProps {
  name: IconName;
  /** "danger" is for the emergency card. */
  tone?: "teal" | "danger";
  className?: string;
}

/** A 48 px rounded tile holding a decorative icon (hidden from assistive technology). */
export function IconTile({ name, tone = "teal", className }: IconTileProps) {
  const Icon = ICONS[name];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-control",
        tone === "teal" ? "bg-teal-100 text-navy-900" : "bg-danger-50 text-danger-700",
        className,
      )}
    >
      <Icon className="size-6" strokeWidth={2} />
    </span>
  );
}
