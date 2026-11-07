import Link from "next/link";

import { cn } from "@/lib/cn";
import { PRESETS, presetPath, type PresetId } from "@/presets/specialties";

/** Plain links, so switching works without JavaScript and every view has its own address. */
export function PresetSwitcher({ current }: { current: PresetId }) {
  return (
    <nav aria-label="Choose your specialty" className="preset-switcher">
      <ul className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = preset.id === current;
          return (
            <li key={preset.id}>
              <Link
                href={presetPath(preset.id)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                  active ? "preset-tab-active border-transparent" : "border-border bg-white text-navy-900 hover:bg-surface",
                )}
              >
                {preset.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
