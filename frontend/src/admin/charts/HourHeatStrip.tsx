"use client";

import { useState } from "react";

import type { Insights } from "@/admin/lib/schemas";

import { heatLevel, hourLabel, hourWindow } from "./model";
import { useRoving } from "./useRoving";

/**
 * Busiest hours (clinic time) as one strip of cells, light to dark in one colour. Each cell is a labelled
 * image; the strip is one tab stop with arrow keys; the figure shows on hover and focus and the busiest
 * hour carries a marker, so no cell depends on its shade alone.
 */
export function HourHeatStrip({ byHour }: { byHour: Insights["byHour"] }) {
  const { from, to } = hourWindow(byHour);
  const hours = byHour.filter((entry) => entry.hour >= from && entry.hour <= to);
  const max = Math.max(0, ...hours.map((entry) => entry.count));
  const [shown, setShown] = useState<number | null>(null);
  const roving = useRoving(hours.length);
  const readout = shown === null ? null : hours[shown];
  return (
    <div className="heat" onKeyDown={roving.onKeyDown}>
      <div className="heat-cells" role="group" aria-label="Bookings by hour of the day">
        {hours.map((entry, index) => {
          const level = heatLevel(entry.count, max);
          const rove = roving.props(index);
          const peak = entry.count === max && max > 0;
          return (
            <span
              key={entry.hour}
              role="img"
              aria-label={`${hourLabel(entry.hour)} to ${hourLabel((entry.hour + 1) % 24)}: ${entry.count} ${entry.count === 1 ? "booking" : "bookings"}`}
              className={`cell level-${level}${peak ? " peak" : ""}`}
              data-hour={entry.hour}
              data-count={entry.count}
              {...rove}
              onFocus={() => {
                rove.onFocus();
                setShown(index);
              }}
              onBlur={() => setShown(null)}
              onMouseEnter={() => setShown(index)}
              onMouseLeave={() => setShown(null)}
            >
              {peak ? <span aria-hidden="true">▲</span> : null}
            </span>
          );
        })}
      </div>
      <div className="heat-axis" aria-hidden="true">
        {hours.map((entry) => (
          <span key={entry.hour}>{entry.hour % 2 === 0 ? String(entry.hour).padStart(2, "0") : ""}</span>
        ))}
      </div>
      <p className="heat-readout" aria-hidden="true">
        {readout ? `${hourLabel(readout.hour)} to ${hourLabel((readout.hour + 1) % 24)}: ${readout.count} ${readout.count === 1 ? "booking" : "bookings"}` : "Hover or focus an hour for its figure."}
      </p>
    </div>
  );
}
