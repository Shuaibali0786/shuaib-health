import { ArrowDown, ArrowUp, CalendarCheck, CircleCheck, CircleX, Gauge, LogIn, Minus, UserX, type LucideIcon } from "lucide-react";

import type { Kpis, Trend } from "@/admin/lib/schemas";

import { CountUp } from "./CountUp";
import { trendView } from "./model";

type KpiKey = keyof Kpis;

type Definition = { key: KpiKey; label: string; icon: LucideIcon; hint?: string; lowerIsBetter?: boolean };

const DEFINITIONS: readonly Definition[] = [
  { key: "appointments", label: "Appointments", icon: CalendarCheck },
  // "Arrived" is also a status in Today by status (patients in the clinic right now); this KPI counts everyone who has come in.
  { key: "arrived", label: "Checked in", icon: LogIn, hint: "Patients who have arrived today, including those already seen: Arrived plus Completed." },
  { key: "completed", label: "Completed", icon: CircleCheck },
  { key: "noShows", label: "No-shows", icon: UserX, lowerIsBetter: true },
  { key: "cancellations", label: "Cancellations", icon: CircleX, lowerIsBetter: true },
  { key: "utilisationPct", label: "Chair utilisation", icon: Gauge },
];

const ARROW = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** One number of today with its change on the same weekday last week. Utilisation is a percent and moves in points. */
export function KpiCard({ id, label, icon: Icon, trend, percent = false, hint, lowerIsBetter = false }: { id: string; label: string; icon: LucideIcon; trend: Trend; percent?: boolean; hint?: string; lowerIsBetter?: boolean }) {
  const view = trendView(trend, percent ? "pts" : "", lowerIsBetter);
  const Arrow = view ? ARROW[view.direction] : null;
  const tipId = `kpi-tip-${id}`;
  return (
    <div className="card kpi" data-kpi={id}>
      <div className="label">
        <Icon className="i i-sm" aria-hidden="true" />
        {hint ? (
          <span className="has-tip" tabIndex={0} aria-describedby={tipId}>
            {label}
            <span className="tip" role="tooltip" id={tipId}>
              {hint}
            </span>
          </span>
        ) : (
          label
        )}
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
            <span className={`trend ${view.tone} ${view.direction}`}>
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
        <KpiCard key={definition.key} id={definition.key} label={definition.label} icon={definition.icon} trend={kpis[definition.key]} percent={definition.key === "utilisationPct"} hint={definition.hint} lowerIsBetter={definition.lowerIsBetter} />
      ))}
    </section>
  );
}
