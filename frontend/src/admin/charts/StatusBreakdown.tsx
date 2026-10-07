import { StatusBadge } from "@/admin/bookings/StatusBadge";
import type { Insights } from "@/admin/lib/schemas";

/** The five statuses as a stacked bar (no-show hatched, cancelled dotted, so colour is never alone) and a list with counts and shares. */
export function StatusBreakdown({ rows }: { rows: Insights["byStatus"] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="breakdown" data-testid="status-breakdown">
      <div className="mix-bar insight-bar" aria-hidden="true">
        {rows
          .filter((row) => row.count > 0)
          .map((row) => (
            <span key={row.status} className={`${row.status} st-${row.status}`} style={{ flex: row.count }} />
          ))}
      </div>
      <ul className="mix-list">
        {rows.map((row) => (
          <li key={row.status} data-status={row.status}>
            <StatusBadge status={row.status} />
            <span className="n num">{row.count}</span>
            <span className="pc num">{total === 0 ? 0 : Math.round((row.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
