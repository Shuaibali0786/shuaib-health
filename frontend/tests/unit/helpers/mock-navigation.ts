// A tiny in-memory stand-in for `next/navigation`, so a client component that keeps its state in the
// URL (the booking flow) can be tested: push/replace update the search params and re-render.
//
// Use it as: vi.mock("next/navigation", async () => await import("./helpers/mock-navigation"));
import { useMemo, useSyncExternalStore } from "react";

const BASE = "/book-appointment";
let url = BASE;
const listeners = new Set<() => void>();

export const navigationCalls: { method: "push" | "replace"; url: string }[] = [];

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function go(method: "push" | "replace", to: string): void {
  navigationCalls.push({ method, url: to });
  url = to;
  for (const listener of listeners) listener();
}

/** Start a test at `/book-appointment` plus an optional query such as `?doctor=dr-x`. */
export function resetNavigation(query = ""): void {
  navigationCalls.length = 0;
  url = `${BASE}${query}`;
  for (const listener of listeners) listener();
}

export function currentUrl(): string {
  return url;
}

export function useSearchParams(): URLSearchParams {
  const href = useSyncExternalStore(subscribe, () => url, () => url);
  return useMemo(() => new URLSearchParams(href.split("?")[1] ?? ""), [href]);
}

const router = {
  push: (to: string) => go("push", to),
  replace: (to: string) => go("replace", to),
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return BASE;
}
