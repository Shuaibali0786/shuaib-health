"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

/**
 * Modal behaviour shared by the drawer and the dialogs: while `open`, focus moves into the panel, Tab
 * and Shift+Tab stay inside it, Escape closes it, and when it closes focus returns to the element that
 * opened it. `initialFocus` picks the first focused element (a dialog that asks a question focuses its
 * safe button); the default is the first focusable element, else the panel itself.
 */
export function useModal(open: boolean, onClose: () => void, initialFocus?: () => HTMLElement | null) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  const pickInitial = useRef(initialFocus);

  // Keep the latest callbacks without re-running the modal effect (which would steal focus again).
  useEffect(() => {
    close.current = onClose;
    pickInitial.current = initialFocus;
  });

  useEffect(() => {
    if (!open) return;
    const container = panel.current;
    if (!container) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (pickInitial.current?.() ?? focusables(container)[0] ?? container).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!container) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const target = opener.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  return panel;
}
