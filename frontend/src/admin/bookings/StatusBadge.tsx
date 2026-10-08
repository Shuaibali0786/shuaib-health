import { CalendarCheck, CircleCheck, CircleX, LogIn, UserX, type LucideIcon } from "lucide-react";

import type { BookingStatus } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";

export const STATUS_ICON: Record<BookingStatus, LucideIcon> = {
  confirmed: CalendarCheck,
  arrived: LogIn,
  completed: CircleCheck,
  no_show: UserX,
  cancelled: CircleX,
};

/**
 * The status as an icon and a word, never colour alone: No-show has a dashed outline and Cancelled a
 * struck-through label, so the five stay apart for anyone who cannot tell the colours apart.
 */
export function StatusBadge({ status }: { status: BookingStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`pill st-${status}`} data-status={status}>
      <Icon className="i i-sm" aria-hidden="true" />
      <span className="lbl">{STATUS_LABEL[status]}</span>
    </span>
  );
}
