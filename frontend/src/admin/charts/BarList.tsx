import type { Insights } from "@/admin/lib/schemas";

/**
 * Bookings by department as horizontal bars: the solid part is bookings kept, the hatched part is the
 * department's cancelled bookings, on one shared scale. The numbers are in words beside each bar.
 */
export function BarList({ rows }: { rows: Insights["byDepartment"] }) {
  const max = Math.max(1, ...rows.map((row) => row.count + row.cancelled));
  return (
    <ul className="barlist" aria-label="Bookings by department">
      {rows.map((row) => (
        <li key={row.departmentName} data-department={row.departmentName}>
          <span className="name">{row.departmentName}</span>
          <span className="track" role="img" aria-label={`${row.departmentName}: ${row.count} ${row.count === 1 ? "booking" : "bookings"}, ${row.cancelled} cancelled`}>
            <span className="fill" style={{ width: `${(row.count / max) * 100}%` }} />
            {row.cancelled > 0 ? <span className="fill cancelled" style={{ width: `${(row.cancelled / max) * 100}%` }} /> : null}
          </span>
          <span className="value num">
            {row.count}
            {row.cancelled > 0 ? <small> +{row.cancelled} cancelled</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
