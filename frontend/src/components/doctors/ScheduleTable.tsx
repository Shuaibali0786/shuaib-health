import { formatDayLong, formatTimeRange } from "@/lib/format";
import { groupScheduleByDay } from "@/lib/schedule";
import type { ScheduleSession } from "@/types/content";

/**
 * A doctor's weekly schedule as a real table: one row per weekday, row headers for the days,
 * sessions joined on one line. All times are Asia/Karachi (PKT), stated in the caption.
 */
export function ScheduleTable({ schedule }: { schedule: ScheduleSession[] }) {
  const rows = groupScheduleByDay(schedule);
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <table className="w-full text-left text-base">
        <caption className="bg-surface px-4 py-3 text-left text-sm font-semibold text-navy-900">
          Weekly schedule (Asia/Karachi time, PKT). Sample schedule.
        </caption>
        <thead>
          <tr className="border-t border-border text-sm text-muted">
            <th scope="col" className="px-4 py-2 font-semibold">
              Day
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day} className="border-t border-border">
              <th scope="row" className="px-4 py-3 font-semibold text-navy-900">
                {formatDayLong(row.day)}
              </th>
              <td className="px-4 py-3 text-ink">
                {row.sessions.map((session) => formatTimeRange(session.start, session.end)).join(" and ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
