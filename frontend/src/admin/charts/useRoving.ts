"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";

/**
 * One tab stop for a row of marks, arrow keys inside it (Left/Right, Home, End). A 90-day chart is one
 * stop in the tab order, not ninety. `props(i)` goes on each mark; `onKeyDown` on the group.
 */
export function useRoving(count: number) {
  const [active, setActive] = useState(0);
  const refs = useRef<(Element | null)[]>([]);
  const focusAt = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(count - 1, index));
      setActive(next);
      (refs.current[next] as SVGElement | HTMLElement | null)?.focus();
    },
    [count],
  );
  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: count - 1 };
    const target = keys[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusAt(target);
  };
  const props = (index: number) => ({
    tabIndex: index === active ? 0 : -1,
    ref: (element: Element | null) => {
      refs.current[index] = element;
    },
    onFocus: () => setActive(index),
  });
  return { active, onKeyDown, props };
}
