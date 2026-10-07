import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { clinicDate, formatDayMonth, formatTime } from "@/admin/lib/format";
import type { ActivityEvent, ActivityPage, Staff } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";
import { EmptyState } from "@/admin/ui/States";

/** The events the feed can show, in words, in the order the filter lists them. */
export const ACTIONS: readonly { value: string; label: string }[] = [
  { value: "auth.sign_in", label: "Signed in" },
  { value: "auth.sign_in_failed", label: "Failed sign-in" },
  { value: "auth.lockout", label: "Locked out" },
  { value: "auth.sign_out", label: "Signed out" },
  { value: "auth.session_expired", label: "Session ended" },
  { value: "auth.password_changed", label: "Changed password" },
  { value: "booking.status_changed", label: "Changed a booking status" },
  { value: "booking.status_undone", label: "Undid a status change" },
  { value: "booking.phone_revealed", label: "Revealed a phone number" },
  { value: "staff.created", label: "Created a staff account" },
  { value: "staff.password_reset", label: "Reset a password" },
  { value: "staff.deactivated", label: "Deactivated a staff account" },
  { value: "staff.reactivated", label: "Reactivated a staff account" },
  { value: "staff.role_changed", label: "Changed a role" },
];
const LABEL = new Map(ACTIONS.map((a) => [a.value, a.label]));
const OUTCOME: Record<string, string> = { refused: "Refused", bad_credentials: "Wrong password", locked: "Locked", inactive: "Account inactive" };

const statusWord = (status?: string | null) => (status && status in STATUS_LABEL ? STATUS_LABEL[status as keyof typeof STATUS_LABEL] : (status ?? ""));

export function describe(event: ActivityEvent): string {
  const base = LABEL.get(event.action) ?? event.action;
  const change = event.fromStatus && event.toStatus ? `: ${statusWord(event.fromStatus)} to ${statusWord(event.toStatus)}` : "";
  return `${base}${change}`;
}

function href(params: { action?: string; staffId?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.staffId) query.set("staffId", params.staffId);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return `/admin/activity${text ? `?${text}` : ""}`;
}

/**
 * The audit feed, newest first: when, who, what and the booking it was about, with a short network tag
 * instead of an address. Filters are a plain GET form and pages are links, so it works and can be shared
 * without script. Nothing personal is in an event, so nothing personal can appear here.
 */
export function ActivityFeed({ data, staff, action, staffId, sample }: { data: ActivityPage; staff: Staff[]; action?: string; staffId?: string; sample: boolean }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.total, data.page * data.pageSize);
  return (
    <>
      <form method="get" action="/admin/activity" className="card filters activity-filters" aria-label="Filter the activity">
        <div className="field">
          <label htmlFor="activity-action">Event</label>
          <select id="activity-action" name="action" defaultValue={action ?? ""}>
            <option value="">All events</option>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="activity-staff">Staff member</label>
          <select id="activity-staff" name="staffId" defaultValue={staffId ?? ""}>
            <option value="">Everyone</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-sm">
          Apply
        </button>
        {action || staffId ? (
          <Link href="/admin/activity" className="btn btn-sm btn-quiet">
            Clear
          </Link>
        ) : null}
      </form>

      {data.items.length === 0 ? (
        <EmptyState title="No activity matches">Try another event or staff member, or clear the filters.</EmptyState>
      ) : (
        <section className="card" aria-label="Activity">
          <div className="table-wrap">
            <table className="table activity-table">
              <caption className="sr-only">Activity, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Booking</th>
                  <th scope="col">Network</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((event) => (
                  <tr key={event.id} data-action={event.action}>
                    <td className="when">
                      <time dateTime={event.at}>
                        {formatDayMonth(clinicDate(event.at))}, {formatTime(event.at)}
                      </time>
                    </td>
                    <td className="who-cell">
                      {event.actorName ? (
                        <>
                          <b>{event.actorName}</b>
                          <span>{event.actorRole === "admin" ? "Admin" : "Receptionist"}</span>
                        </>
                      ) : (
                        <span>Not signed in</span>
                      )}
                    </td>
                    <td>
                      {describe(event)}
                      {event.outcome !== "ok" ? <span className="pill pill-off outcome">{OUTCOME[event.outcome] ?? event.outcome}</span> : null}
                    </td>
                    <td className="ref">{event.bookingReference ?? "—"}</td>
                    <td className="ref tag" title="First six characters of a one-way code for the network address">
                      {event.networkTag}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span data-testid="page-count">
              Showing {first}–{last} of {data.total} events{sample ? " (sample data)" : ""}
            </span>
            {pages > 1 ? (
              <nav className="pager" aria-label="Pages">
                {data.page > 1 ? (
                  <Link href={href({ action, staffId, page: data.page - 1 })} aria-label="Previous page" rel="prev" prefetch={false}>
                    <ChevronLeft className="i i-sm" aria-hidden="true" />
                  </Link>
                ) : (
                  <span aria-hidden="true" className="disabled">
                    <ChevronLeft className="i i-sm" />
                  </span>
                )}
                <span aria-current="page" className="current">
                  Page {data.page} of {pages}
                </span>
                {data.page < pages ? (
                  <Link href={href({ action, staffId, page: data.page + 1 })} aria-label="Next page" rel="next" prefetch={false}>
                    <ChevronRight className="i i-sm" aria-hidden="true" />
                  </Link>
                ) : (
                  <span aria-hidden="true" className="disabled">
                    <ChevronRight className="i i-sm" />
                  </span>
                )}
              </nav>
            ) : null}
          </div>
        </section>
      )}
    </>
  );
}
