import Link from "next/link";

import { formatDayMonth } from "@/admin/lib/format";
import { INSIGHT_RANGES, type Insights } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";
import { EmptyState } from "@/admin/ui/States";

import { BarList } from "./BarList";
import { ChartFigure } from "./ChartFigure";
import { ColumnChart } from "./ColumnChart";
import { HourHeatStrip } from "./HourHeatStrip";
import { StatusBreakdown } from "./StatusBreakdown";
import { MIN_BOOKINGS, departmentSummary, hourLabel, hourSummary, hourWindow, perDaySummary, statusSummary } from "./model";

/** 7, 30 or 90 days, in the address (`?range=`) so a screen can be shared, reloaded and read without script. */
export function RangeSwitch({ current }: { current: number }) {
  return (
    <nav className="range-switch" aria-label="Date range">
      {INSIGHT_RANGES.map((days) => (
        <Link key={days} href={`/admin/insights?range=${days}`} aria-current={days === current ? "page" : undefined} scroll={false} prefetch={false}>
          {days} days
        </Link>
      ))}
    </nav>
  );
}

/** The four charts of Insights, each with its summary sentence and a table of the same numbers. */
export function InsightsView({ data }: { data: Insights }) {
  if (data.total < MIN_BOOKINGS) {
    return (
      <EmptyState title="Not enough bookings to chart yet">
        There are {data.total === 1 ? "only 1 booking" : `only ${data.total} bookings`} in the last {data.rangeDays} days. Charts appear once there are at least {MIN_BOOKINGS}. Try a longer range.
      </EmptyState>
    );
  }
  const window = hourWindow(data.byHour);
  const statusTotal = data.byStatus.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="insights-grid">
      <div className="span-2">
        <ChartFigure
          id="per-day"
          title="Bookings per day"
          summary={perDaySummary(data)}
          table={{ caption: `Bookings per day, ${formatDayMonth(data.from)} to ${formatDayMonth(data.to)}`, head: ["Date", "Bookings"], rows: data.perDay.map((day) => [formatDayMonth(day.date), day.count]) }}
        >
          <ColumnChart days={data.perDay} ariaLabel={`Bookings per day for the last ${data.rangeDays} days`} />
        </ChartFigure>
      </div>

      <ChartFigure
        id="by-department"
        title="By department"
        summary={departmentSummary(data)}
        legend={
          <>
            <span className="key">
              <i className="swatch" aria-hidden="true" /> Bookings
            </span>
            <span className="key">
              <i className="swatch cancelled" aria-hidden="true" /> Cancelled
            </span>
          </>
        }
        table={{ caption: "Bookings by department", head: ["Department", "Bookings", "Cancelled"], rows: data.byDepartment.map((row) => [row.departmentName, row.count, row.cancelled]) }}
      >
        <BarList rows={data.byDepartment} />
      </ChartFigure>

      <ChartFigure
        id="by-status"
        title="By status"
        summary={statusSummary(data)}
        table={{ caption: "Bookings by status", head: ["Status", "Bookings", "Share"], rows: data.byStatus.map((row) => [STATUS_LABEL[row.status], row.count, `${statusTotal === 0 ? 0 : Math.round((row.count / statusTotal) * 100)}%`]) }}
      >
        <StatusBreakdown rows={data.byStatus} />
      </ChartFigure>

      <div className="span-2">
        <ChartFigure
          id="by-hour"
          title="Busiest hours"
          summary={hourSummary(data)}
          legend={
            <span className="key scale" aria-hidden="true">
              Fewer <i className="swatch level-1" /> <i className="swatch level-2" /> <i className="swatch level-3" /> <i className="swatch level-4" /> More
            </span>
          }
          table={{
            caption: "Bookings by hour of the day, clinic time",
            head: ["Hour", "Bookings"],
            rows: data.byHour.filter((row) => row.hour >= window.from && row.hour <= window.to).map((row) => [`${hourLabel(row.hour)} to ${hourLabel((row.hour + 1) % 24)}`, row.count]),
          }}
        >
          <HourHeatStrip byHour={data.byHour} />
        </ChartFigure>
      </div>
    </div>
  );
}
