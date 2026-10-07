// The pure half of the Command Centre theme: the three choices, their names, the cookie text and the rules that
// need no browser and no React, so that a Server Component (the layouts read the cookie) can import it.

export type ThemePreference = "light" | "dark" | "system";

export const THEME_COOKIE = "cc_theme";
export const ONE_YEAR_SECONDS = 31_536_000;

/** What each choice is called on the buttons. */
export const THEME_LABEL: Record<ThemePreference, string> = { light: "Light", dark: "Night", system: "Auto" };
export const THEME_ORDER: readonly ThemePreference[] = ["light", "dark", "system"];

/** The phone's single button cycles Light, then Night, then Auto, then Light again. */
export const NEXT_THEME: Record<ThemePreference, ThemePreference> = { light: "dark", dark: "system", system: "light" };

export function parsePreference(value: string | null | undefined): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  return preference === "dark" || (preference === "system" && systemIsDark) ? "dark" : "light";
}

/** The cookie text: the whole staff app, one year, not sent from other sites. A preference, not personal data. */
export function themeCookie(preference: ThemePreference): string {
  return `${THEME_COOKIE}=${preference}; Path=/admin; SameSite=Lax; Max-Age=${ONE_YEAR_SECONDS}`;
}

/** The button's accessible name: what is on now and what a press does. */
export function cycleLabel(preference: ThemePreference): string {
  return `Theme: ${THEME_LABEL[preference]}. Switch to ${THEME_LABEL[NEXT_THEME[preference]]}.`;
}
