/** Shared motion constants (design-system.md §8). Kept subtle; reduced motion removes movement. */

/** Reveal fade/slide duration in seconds. */
export const REVEAL_DURATION = 0.5;

/** Reveal rise distance in pixels. */
export const REVEAL_OFFSET_Y = 16;

/** Delay between cards in a group, in seconds. */
export const REVEAL_STAGGER = 0.06;

/** No reveal waits longer than this, in seconds. */
export const REVEAL_MAX_DELAY = 0.3;

/** Same curve as the --ease-soft token in globals.css. */
export const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];
