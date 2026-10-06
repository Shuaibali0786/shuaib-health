"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server HTML and until the page has hydrated, then true. A form whose submit button is
 * disabled until then cannot be submitted natively (a plain GET that would put the typed password in
 * the address bar) before its own handler is attached.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
