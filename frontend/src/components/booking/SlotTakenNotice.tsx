"use client";

import { useEffect, useRef } from "react";
import { formatLocalDate } from "@/lib/booking/labels";
import type { AlternativeSlot } from "@/lib/booking/schemas";

interface SlotTakenNoticeProps {
  message: string;
  alternatives: AlternativeSlot[];
  onChoose: (alternative: AlternativeSlot) => void;
  onSeeAll: () => void;
}

const CHOICE =
  "inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-4 py-2 text-base font-semibold text-navy-900 transition-colors hover:bg-surface";

/** Shown when the chosen time was just booked by someone else. The visitor's details stay in the form. */
export function SlotTakenNotice({ message, alternatives, onChoose, onSeeAll }: SlotTakenNoticeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div ref={ref} role="alert" tabIndex={-1} className="flex flex-col gap-3 rounded-card border-2 border-danger-700 bg-danger-50 p-4 text-base focus:outline-none">
      <p className="font-bold text-danger-700">{message}</p>
      {alternatives.length > 0 ? (
        <>
          <p>The next free times:</p>
          <ul className="flex flex-wrap gap-2">
            {alternatives.map((alternative) => (
              <li key={alternative.startsAt}>
                <button type="button" onClick={() => onChoose(alternative)} className={CHOICE}>
                  {`${formatLocalDate(alternative.localDate)}, ${alternative.localTime}`}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div>
        <button type="button" onClick={onSeeAll} className={CHOICE}>
          See all times
        </button>
      </div>
    </div>
  );
}
