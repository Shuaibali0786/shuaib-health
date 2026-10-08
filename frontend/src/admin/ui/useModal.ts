"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open modals, innermost last: a dialog opened over the drawer handles Tab and Escape, the drawer waits. */
const openModals: object[] = [];

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

/**
 * What Tab cycles through while a modal is open: the modal's own controls, then the controls of any toast marked
 * `data-trap-also`. A toast sits outside the modal, but its "Undo" lasts only ten seconds, so a keyboard user
 * who is working in the drawer must be able to reach it without closing the drawer.
 */
function tabOrder(container: HTMLElement): HTMLElement[] {
  const toasts = [...document.querySelectorAll<HTMLElement>("[data-trap-also]")].filter((toast) => !container.contains(toast));
  return [...focusables(container), ...toasts.flatMap(focusables)];
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
    const token = {};
    openModals.push(token);
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (pickInitial.current?.() ?? focusables(container)[0] ?? container).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!container || openModals[openModals.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = tabOrder(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      // Tab moves one step round the ring (the modal, then its toasts, then the modal again).
      const index = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1;
      const step = event.shiftKey ? -1 : 1;
      const next = index === -1 ? (event.shiftKey ? items[items.length - 1] : items[0]) : items[(index + step + items.length) % items.length];
      event.preventDefault();
      next?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      openModals.splice(openModals.indexOf(token), 1);
      const target = opener.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  return panel;
}
