// The Command Centre theme: Light, Night (the navy night theme) or Auto (follow the device).
// The choice lives in the `cc_theme` cookie, which the root layout reads on the server, so the right theme is
// on <html> before the first paint (no flash) and also without JavaScript. This module is the browser half:
// it writes the cookie, puts the choice on <html> at once, and tells every switch on the page (the sidebar's
// and the phone's) when it changes. "Auto" is resolved by CSS (`prefers-color-scheme`), so it follows the
// device live; `watchSystem` is for the labels that say which theme Auto currently means.
import { useSyncExternalStore } from "react";

import { parsePreference, themeCookie, type ThemePreference } from "./themeCore";

export * from "./themeCore";

const EVENT = "cc-theme-change";

/** The preference on <html> (what the server rendered, or the last choice made here). */
export function currentPreference(root: HTMLElement = document.documentElement, fallback: ThemePreference = "light"): ThemePreference {
  return parsePreference(root.dataset.themePref ?? fallback);
}

/** Applies a choice now (no reload, no flash), remembers it on this device and tells the switches. */
export function applyTheme(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  root.dataset.themePref = preference;
  root.dataset.theme = preference === "dark" ? "dark" : "light"; // Auto: CSS applies Night while the device is dark
  document.cookie = themeCookie(preference);
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

/** The preference, in step across every switch on the page. `initial` is what the server rendered. */
export function useThemePreference(initial: ThemePreference): ThemePreference {
  return useSyncExternalStore(subscribe, () => currentPreference(document.documentElement, initial), () => initial);
}

/** Calls `listener` with whether the device prefers dark now and whenever that changes. */
export function watchSystem(listener: (isDark: boolean) => void, query: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)")): () => void {
  listener(query.matches);
  const onChange = (event: MediaQueryListEvent) => listener(event.matches);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
