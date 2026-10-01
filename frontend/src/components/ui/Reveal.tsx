"use client";

import { animate } from "framer-motion/dom/mini";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { EASE_SOFT, REVEAL_DURATION, REVEAL_MAX_DELAY, REVEAL_OFFSET_Y } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  /** Seconds to wait before animating, clamped to 0.3 so nothing feels slow. */
  delay?: number;
  as?: "div" | "li";
  className?: string;
}

type EntryHandler = (entry: IntersectionObserverEntry) => void;

/**
 * One observer shared by every Reveal on the page. Reading each block's position separately
 * (getBoundingClientRect in every effect) forced the browser to lay the page out dozens of
 * times during hydration; observer callbacks arrive in a single batch with the positions
 * already computed.
 */
const handlers = new WeakMap<Element, EntryHandler>();
let sharedObserver: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  sharedObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) handlers.get(entry.target)?.(entry);
  });
  return sharedObserver;
}

/**
 * Progressive scroll reveal (research.md R3).
 * - The server renders the content fully visible, so it works without JavaScript.
 * - After hydration, the first observer report decides: a block already on screen (or scrolled
 *   past) is never touched, so above-the-fold content and LCP are unaffected; a block below the
 *   fold is hidden, then fades in and rises 16 px once when it scrolls into view.
 * - With prefers-reduced-motion, or where IntersectionObserver is missing, nothing is hidden and
 *   nothing moves.
 */
export function Reveal({ children, delay = 0, as = "div", className }: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const setElement = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const reset = () => {
      element.style.opacity = "";
      element.style.transform = "";
    };
    const stopWatching = () => {
      observer().unobserve(element);
      handlers.delete(element);
    };

    let hidden = false;
    handlers.set(element, (entry) => {
      if (!hidden) {
        const scrolledPast = entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0);
        if (entry.isIntersecting || scrolledPast) {
          stopWatching(); // visible (or already behind the reader): leave it alone
          return;
        }
        hidden = true;
        element.style.opacity = "0";
        element.style.transform = `translateY(${REVEAL_OFFSET_Y}px)`;
        return;
      }
      if (!entry.isIntersecting) return;
      stopWatching();
      animate(
        element,
        { opacity: 1, transform: "translateY(0px)" },
        { duration: REVEAL_DURATION, delay: Math.min(delay, REVEAL_MAX_DELAY), ease: EASE_SOFT },
      ).then(reset);
    });
    observer().observe(element);

    return () => {
      stopWatching();
      reset();
    };
  }, [delay]);

  return as === "li" ? (
    <li ref={setElement} className={className}>
      {children}
    </li>
  ) : (
    <div ref={setElement} className={className}>
      {children}
    </div>
  );
}
