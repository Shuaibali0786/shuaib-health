"use client";

import type { FocusEvent, ReactNode } from "react";

interface SwipeListProps {
  className?: string;
  children: ReactNode;
}

/**
 * A list that is a horizontal swipe row on phones (see swipe-row.ts) and a normal grid
 * from sm up. It exists for keyboard users: when Tab lands on a link inside a card, the
 * browser only scrolls enough to reveal that small link, which can leave most of the card
 * (and its focus ring) off screen. This scrolls the whole card into view, aligned to the
 * row's start, but only when the row is actually scrollable and the card is not fully
 * visible. The row is `relative`, so `offsetLeft` is measured from its own edge.
 */
export function SwipeList({ className, children }: SwipeListProps) {
  const revealFocusedCard = (event: FocusEvent<HTMLUListElement>) => {
    const row = event.currentTarget;
    if (row.scrollWidth <= row.clientWidth) return; // not a swipe row at this screen size

    const card = (event.target as HTMLElement).closest("li");
    if (!card || card.parentElement !== row) return;

    const left = card.offsetLeft - row.scrollLeft;
    const right = left + card.offsetWidth;
    if (left >= 0 && right <= row.clientWidth) return; // already fully in view

    const padding = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    row.scrollTo({ left: card.offsetLeft - padding });
  };

  return (
    <ul className={className} onFocus={revealFocusedCard}>
      {children}
    </ul>
  );
}
