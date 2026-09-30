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

/**
 * Progressive scroll reveal (research.md R3).
 * - The server renders the content fully visible, so it works without JavaScript.
 * - After hydration, only blocks that are below the fold get hidden, then fade
 *   in and rise 16 px once when they scroll into view. Blocks already on screen
 *   are never touched, so above-the-fold content and LCP are unaffected.
 * - With prefers-reduced-motion the block is never hidden and never moves.
 */
export function Reveal({ children, delay = 0, as = "div", className }: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const setElement = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    const reset = () => {
      element.style.opacity = "";
      element.style.transform = "";
    };

    element.style.opacity = "0";
    element.style.transform = `translateY(${REVEAL_OFFSET_Y}px)`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        animate(
          element,
          { opacity: 1, transform: "translateY(0px)" },
          { duration: REVEAL_DURATION, delay: Math.min(delay, REVEAL_MAX_DELAY), ease: EASE_SOFT },
        ).then(reset);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
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
