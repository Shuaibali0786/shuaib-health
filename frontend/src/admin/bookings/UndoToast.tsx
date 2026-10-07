"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { undoStore } from "@/admin/state/undo";

/**
 * "Marked Ayesha K. as arrived. Undo (7)": the offer that follows a status change (FR-025). A status
 * region, so it is announced without taking focus; the ring counts the ten seconds down.
 */
export function UndoToast() {
  useSyncExternalStore(undoStore.subscribe, undoStore.getSnapshot, () => 0);
  const offer = undoStore.current();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!offer) return;
    const timer = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [offer]);

  if (!offer) return null;
  const seconds = undoStore.secondsLeft();
  return (
    <div className="toast" role="status" data-testid="undo-toast" data-trap-also="">
      <span>{offer.message}</span>
      <button type="button" className="undo" onClick={() => void undoStore.undo()}>
        Undo
      </button>
      <span className="ring" aria-label={`${seconds} seconds left`}>
        {seconds}
      </span>
    </div>
  );
}
