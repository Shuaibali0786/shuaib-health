"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { NEXT_THEME, THEME_LABEL, THEME_ORDER, applyTheme, cycleLabel, resolveTheme, useThemePreference, watchSystem, type ThemePreference } from "@/admin/state/theme";

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/** Whether the device prefers dark, so Auto can say which theme it means right now. */
function useSystemIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => watchSystem(setDark), []);
  return dark;
}

/**
 * The sidebar's switch: Light, Night, Auto as a segmented control (`aria-pressed`). The choice is applied at once
 * and remembered in the `cc_theme` cookie; the first paint already has it, because the server read the cookie.
 */
export function ThemeSwitch({ initial }: { initial: ThemePreference }) {
  const preference = useThemePreference(initial);
  const systemIsDark = useSystemIsDark();
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      <span className="cap" aria-hidden="true">
        Theme
      </span>
      <div className="seg">
        {THEME_ORDER.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={preference === choice}
            data-theme-choice={choice}
            title={choice === "system" ? `Auto follows this device (now ${resolveTheme("system", systemIsDark) === "dark" ? "Night" : "Light"})` : undefined}
            onClick={() => applyTheme(choice)}
          >
            {THEME_LABEL[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The phone's top-bar button: one press moves to the next theme, Light, then Night, then Auto. */
export function ThemeCycle({ initial }: { initial: ThemePreference }) {
  const preference = useThemePreference(initial);
  const Icon = ICON[preference];
  return (
    <button type="button" className="theme-cycle" aria-label={cycleLabel(preference)} data-theme-cycle={preference} onClick={() => applyTheme(NEXT_THEME[preference])}>
      <Icon className="i i-sm" aria-hidden="true" />
    </button>
  );
}
