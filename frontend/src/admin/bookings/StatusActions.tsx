import { CircleX, LogIn, CircleCheck, UserX, type LucideIcon } from "lucide-react";

import type { BookingStatus } from "@/admin/lib/schemas";

export const ACTION_LABEL: Record<Exclude<BookingStatus, "confirmed">, string> = {
  arrived: "Mark arrived",
  completed: "Mark completed",
  no_show: "Mark no-show",
  cancelled: "Cancel booking",
};
const ACTION_ICON: Record<Exclude<BookingStatus, "confirmed">, LucideIcon> = { arrived: LogIn, completed: CircleCheck, no_show: UserX, cancelled: CircleX };

/** Only statuses the server (or, in the demo, the same rules) allows now are offered; nothing else is drawn. */
export function StatusActions({ allowedNext, onChoose, disabled = false }: { allowedNext: readonly BookingStatus[]; onChoose: (to: BookingStatus) => void; disabled?: boolean }) {
  const choices = allowedNext.filter((to): to is Exclude<BookingStatus, "confirmed"> => to !== "confirmed");
  const primary = choices.find((to) => to === "arrived" || to === "completed");
  return (
    <div className="acts" role="group" aria-label="Next step">
      {choices.map((to) => {
        const Icon = ACTION_ICON[to];
        return (
          <button key={to} type="button" className={to === primary ? "btn btn-primary" : "btn"} disabled={disabled} onClick={() => onChoose(to)}>
            <Icon className="i i-sm" aria-hidden="true" />
            {ACTION_LABEL[to]}
          </button>
        );
      })}
    </div>
  );
}

/** The one quick action in a list row or card: Arrived for a confirmed booking, Complete for an arrived one. */
export function quickAction(allowedNext: readonly BookingStatus[]): { to: BookingStatus; label: string } | null {
  if (allowedNext.includes("arrived")) return { to: "arrived", label: "Arrived" };
  if (allowedNext.includes("completed")) return { to: "completed", label: "Complete" };
  return null;
}
