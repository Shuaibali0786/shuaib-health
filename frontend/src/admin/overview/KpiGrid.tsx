import { ArrowDown, ArrowUp, CalendarCheck, CircleCheck, CircleX, Gauge, LogIn, Minus, UserX, type LucideIcon } from "lucide-react";

import type { Kpis, Trend } from "@/admin/lib/schemas";

import { CountUp } from "./CountUp";
import { trendView } from "./model";

type KpiKey = keyof Kpis;

const DEFINITIONS: readonly { key: KpiKey; label: string; icon: LucideIcon }[] = [
  { key: "appointments", label: "Appointments", icon: CalendarCheck },
  { key: "arrived", label: "Arrived", icon: LogIn },
  { key: "completed", label: "Completed", icon: CircleCheck },
  { key: "noShows", label: "No-shows", icon: UserX },
  { key: "cancellations", label: "Cancellations", icon: CircleX },
  { key: "utilisationPct", label: "Chair utilisation", icon: Gauge },
];

const ARROW = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** One number of today with its change on the same weekday last week. Utilisation is a percent and moves in points. */
export function KpiCard({ id, label, icon: Icon, trend, percent = false }: { id: string; label: string; icon: LucideIcon; trend: Trend; percent?: boolean }) {
  const view = trendView(trend, percent ? "pts" : "");
  const Arrow = view ? ARROW[view.direction] : null;
  return (
    <div className="card kpi" data-kpi={id}>
      <div className="label">
        <Icon className="i i-sm" aria-hidden="true" />
        {label}
      </div>
      <div className="value">
        {trend.value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Not available, no scheduled slots today</span>
          </>
        ) : (
          <>
            <CountUp value={trend.value} suffix={percent ? "%" : ""} />
            {percent ? <small aria-hidden="true">%</small> : null}
          </>
        )}
      </div>
      <div className="kfoot">
        {view && Arrow ? (
          <>
            <span className={`trend ${view.direction}`}>
              <Arrow className="i i-sm" aria-hidden="true" />
              <span aria-hidden="true">{view.text}</span>
            </span>
            <span className="vs" aria-hidden="true">
              vs {view.label}
            </span>
            <span className="sr-only">{view.phrase}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** The six KPIs: six columns from 1400 px, three below, two on phones (the CSS decides). */
export function KpiGrid({ kpis }: { kpis: Kpis }) {
  return (
    <section className="kpis" aria-label="Today in numbers">
      {DEFINITIONS.map((definition) => (
        <KpiCard key={definition.key} id={definition.key} label={definition.label} icon={definition.icon} trend={kpis[definition.key]} percent={definition.key === "utilisationPct"} />
      ))}
    </section>
  );
}
