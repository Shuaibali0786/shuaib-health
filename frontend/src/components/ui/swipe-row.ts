/**
 * Phone-only horizontal swipe row (below 640 px). From sm up these classes do nothing,
 * so the list keeps its normal grid.
 *
 * - The row bleeds to the screen edges (-mx-4 cancels the 1 rem page padding) and is
 *   padded again inside, so the first card lines up with the page and snap scrolling
 *   stops with the same gap (scroll-pl-4).
 * - Cards are 78% wide with a 1 rem gap, so the next card always peeks in from the right.
 * - Vertical padding (pt-2, pb-6) keeps card shadows and the 2 px + 2 px keyboard focus
 *   outline from being clipped by the scroll container.
 * - Everything inside stays a normal list of links. SwipeList.tsx adds one small behaviour
 *   for keyboard users: it scrolls the whole focused card into view (the browser would only
 *   reveal the small link inside it).
 * - The row is relative, so SwipeList can measure card positions from the row's own edge.
 */
export const SWIPE_ROW =
  "max-sm:relative max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-4 max-sm:overflow-x-auto max-sm:scroll-pl-4 max-sm:px-4 max-sm:pb-6 max-sm:pt-2";

/** Each card in a swipe row. */
export const SWIPE_ITEM = "max-sm:w-[78%] max-sm:shrink-0 max-sm:snap-start";
