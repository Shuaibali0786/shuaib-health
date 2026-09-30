"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () => import("./motion-features").then((module) => module.default);

/**
 * App-wide Framer Motion setup. `reducedMotion="user"` disables transform
 * animations for people who prefer reduced motion. Features load lazily, so
 * pages that never render an `m` component pay nothing for them.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
