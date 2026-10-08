import { StatusBadge } from "@/admin/bookings/StatusBadge";
import { STATUS_LABEL } from "@/admin/lib/statusRules";

import { STATUS_ORDER, type Counts } from "./model";

/** Today by status: a stacked bar (one summary for screen readers), then each status with its count and share. */
export function StatusMix({ counts }: { counts: Counts }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const summary = `Status of today's ${total} bookings: ${STATUS_ORDER.map((status) => `${counts[status]} ${STATUS_LABEL[status].toLowerCase()}`).join(", ")}.`;
  return (
    <div className="mix" data-testid="status-mix">
      <div className="mix-bar" role="img" aria-label={summary}>
        {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
          <span key={status} className={`${status} st-${status}`} style={{ flex: counts[status] }} />
        ))}
      </div>
      <ul className="mix-list">
        {STATUS_ORDER.map((status) => (
          <li key={status} data-status={status}>
            <StatusBadge status={status} />
            <span className="n num">{counts[status]}</span>
            <span className="pc num">{total === 0 ? 0 : Math.round((counts[status] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className="mix-note">Chair utilisation = booked (not cancelled) ÷ scheduled slots for doctors working today.</div>
    </div>
  );
}
