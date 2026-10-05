import { dayStatusLabel, formatLocalDate } from "@/lib/booking/labels";
import type { SlotDay } from "@/lib/booking/schemas";
import { cn } from "@/lib/cn";

interface DateStripProps {
  days: SlotDay[];
  selected: string | undefined;
  onSelect: (date: string) => void;
}

/**
 * The booking window as a horizontally scrollable radio group. A day with nothing to book is
 * disabled and says why in words ("Fully booked", "Clinic closed"), never by colour alone.
 */
export function DateStrip({ days, selected, onSelect }: DateStripProps) {
  return (
    <fieldset>
      <legend className="sr-only">Date</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {days.map((day) => {
          const available = day.status === "available";
          const sub = available ? `${day.slots.length} ${day.slots.length === 1 ? "time" : "times"}` : dayStatusLabel(day.status);
          return (
            <label
              key={day.date}
              className={cn(
                "relative flex min-h-11 min-w-28 shrink-0 cursor-pointer flex-col justify-center rounded-control border px-3 py-2 text-center",
                available ? "border-border-strong bg-white" : "cursor-not-allowed border-border bg-surface text-muted",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-700",
                "has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white",
              )}
            >
              <input
                type="radio"
                name="date"
                value={day.date}
                checked={selected === day.date}
                disabled={!available}
                onChange={() => onSelect(day.date)}
                className="absolute inset-0 size-full cursor-[inherit] opacity-0"
              />
              <span className="block text-base font-bold">{formatLocalDate(day.date)}</span>{" "}
              <span className="block text-sm">{sub}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
