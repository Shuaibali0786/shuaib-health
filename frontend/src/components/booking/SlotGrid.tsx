import { partOfDay, type PartOfDay } from "@/lib/booking/labels";
import type { Slot } from "@/lib/booking/schemas";
import { cn } from "@/lib/cn";

const PARTS: { part: PartOfDay; heading: string }[] = [
  { part: "morning", heading: "Morning" },
  { part: "afternoon", heading: "Afternoon" },
  { part: "evening", heading: "Evening" },
];

interface SlotGridProps {
  slots: Slot[];
  /** The chosen slot's clinic-local time, "HH:MM". */
  selected: string | undefined;
  onSelect: (localTime: string) => void;
}

/** Free times of one day as radio buttons (44 x 44 px at least), grouped by part of the day. */
export function SlotGrid({ slots, selected, onSelect }: SlotGridProps) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="sr-only">Time</legend>
      {PARTS.map(({ part, heading }) => {
        const inPart = slots.filter((slot) => partOfDay(slot.localTime) === part);
        if (inPart.length === 0) return null;
        return (
          <div key={part}>
            <h3 className="mb-2 text-base font-bold text-navy-900">{heading}</h3>
            <div className="flex flex-wrap gap-2">
              {inPart.map((slot) => (
                <label
                  key={slot.startsAt}
                  className={cn(
                    "relative flex min-h-11 min-w-20 cursor-pointer items-center justify-center rounded-control border border-border-strong bg-white px-3 py-2 text-base font-semibold text-navy-900",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700",
                    "has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white",
                  )}
                >
                  <input
                    type="radio"
                    name="time"
                    value={slot.localTime}
                    checked={selected === slot.localTime}
                    onChange={() => onSelect(slot.localTime)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  {slot.localTime}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
