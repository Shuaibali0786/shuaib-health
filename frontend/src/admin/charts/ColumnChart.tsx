"use client";

import { useEffect, useRef, useState } from "react";

import { formatDayMonth } from "@/admin/lib/format";

import { niceMax } from "./model";
import { useRoving } from "./useRoving";

const FIRST_WIDTH = 640; // before the chart is measured, and on the server
const H = 220;
const LEFT = 34;
const TOP = 14;
const BOTTOM = 26;
const RADIUS = 3;

/** A column with only its top corners rounded, standing on the baseline. */
function column(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Bookings per day as thin columns on one axis. Each column is a labelled image ("Mon 5 Oct: 12 bookings"),
 * the row is one tab stop with arrow keys, and the value shows on hover and on focus: no number is printed
 * on every column.
 */
export function ColumnChart({ days, ariaLabel }: { days: { date: string; count: number }[]; ariaLabel: string }) {
  const [shown, setShown] = useState<number | null>(null);
  // The drawing is as wide as its box in real pixels, so its labels are the size of the page's own text on a phone too.
  const [W, setWidth] = useState(FIRST_WIDTH);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const roving = useRoving(days.length);
  const top = niceMax(Math.max(0, ...days.map((day) => day.count)));
  const plotW = W - LEFT - 6;
  const plotH = H - TOP - BOTTOM;
  const slot = plotW / days.length;
  const bar = Math.max(2, Math.min(28, slot - 2));
  const y = (value: number) => TOP + plotH - (value / top) * plotH;
  // A date label needs about 60 px; keep every nth so neighbours never touch, on a phone as on a desktop.
  const labelEvery = Math.max(1, Math.ceil(60 / slot));
  const focused = shown !== null ? days[shown] : undefined;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} height={H} className="chart-svg" role="group" aria-label={ariaLabel} onKeyDown={roving.onKeyDown} data-clip-ok>
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line x1={LEFT} x2={W - 6} y1={y(top * fraction)} y2={y(top * fraction)} className="grid" />
          <text x={LEFT - 6} y={y(top * fraction) + 4} className="axis" textAnchor="end">
            {Math.round(top * fraction)}
          </text>
        </g>
      ))}
      {days.map((day, index) => {
        const x = LEFT + index * slot + (slot - bar) / 2;
        const height = Math.max(day.count > 0 ? 2 : 0, TOP + plotH - y(day.count));
        const label = `${formatDayMonth(day.date)}: ${day.count} ${day.count === 1 ? "booking" : "bookings"}`;
        const isToday = index === days.length - 1;
        const rove = roving.props(index);
        return (
          <g key={day.date}>
            {/* A wide invisible target around a thin mark. */}
            <rect x={LEFT + index * slot} y={TOP} width={slot} height={plotH} className="hit" onMouseEnter={() => setShown(index)} onMouseLeave={() => setShown(null)} />
            <path
              d={column(x, TOP + plotH - height, bar, height)}
              role="img"
              aria-label={label}
              className={`bar${isToday ? " today" : ""}`}
              data-bar={day.date}
              data-count={day.count}
              {...rove}
              onFocus={() => {
                rove.onFocus();
                setShown(index);
              }}
              onBlur={() => setShown(null)}
            />
            {(index % labelEvery === 0 && days.length - 1 - index >= labelEvery) || isToday ? (
              <text x={Math.min(x + bar / 2, W - 4)} y={H - 8} className="axis" textAnchor={x + bar / 2 > W - 24 ? "end" : "middle"}>
                {formatDayMonth(day.date).replace(/^\w+ /, "")}
              </text>
            ) : null}
          </g>
        );
      })}
      {focused && shown !== null ? (
        <g className="tip" pointerEvents="none" aria-hidden="true">
          {(() => {
            const text = `${formatDayMonth(focused.date)} · ${focused.count}`;
            const width = text.length * 6.4 + 16;
            const cx = Math.max(width / 2, Math.min(W - width / 2, LEFT + shown * slot + slot / 2));
            const ty = Math.max(2, y(focused.count) - 30);
            return (
              <>
                <rect x={cx - width / 2} y={ty} width={width} height={22} rx={6} />
                <text x={cx} y={ty + 15} textAnchor="middle">
                  {text}
                </text>
              </>
            );
          })()}
        </g>
      ) : null}
    </svg>
  );
}
