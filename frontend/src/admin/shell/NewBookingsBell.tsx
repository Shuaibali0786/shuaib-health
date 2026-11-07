"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { clinicDate, formatDayMonth } from "@/admin/lib/format";
import { bookedAgo } from "@/admin/lib/relativeTime";
import type { BookingSummary } from "@/admin/lib/schemas";
import { bell } from "@/admin/state/bell";
import { clinicClock } from "@/admin/state/clinicClock";
import { openRequest } from "@/admin/state/openRequest";

/**
 * The bell in the top bar (Feature 012): how many bookings are new for this staff member since they last
 * looked, and the newest few. Clicking one opens it in the Bookings drawer. "Mark all seen" clears the
 * count for this person only. The count and list come from `bell` (one poller for every bell on the page).
 */
export function NewBookingsBell({ demo, timeZone, tone = "light" }: { demo: boolean; timeZone: string; tone?: "light" | "dark" }) {
  useSyncExternalStore(bell.subscribe, bell.getSnapshot, () => 0);
  const data = bell.current();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => bell.attach(demo), [demo]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const count = data?.count ?? 0;
  const label = count === 0 ? "New bookings: none" : `New bookings: ${count}`;

  function openBooking(booking: BookingSummary) {
    setOpen(false);
    openRequest.request(booking);
    if (!pathname.startsWith("/admin/bookings")) router.push("/admin/bookings");
  }

  return (
    <span className="bell" data-tone={tone} ref={root}>
      <button type="button" className="bell-btn" aria-label={label} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}>
        <Bell className="i" aria-hidden="true" />
        {count > 0 ? (
          <span className="bell-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <section className="bell-panel" id={panelId} aria-label="New bookings">
          <header>
            <b>{count === 0 ? "No new bookings" : `${count} new ${count === 1 ? "booking" : "bookings"}`}</b>
            {count > 0 ? (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => void bell.markAllSeen(clinicClock.now())}>
                Mark all seen
              </button>
            ) : null}
          </header>
          {data && data.items.length > 0 ? (
            <ul>
              {data.items.map((booking) => (
                <li key={booking.reference}>
                  <button type="button" onClick={() => openBooking(booking)}>
                    <b>{booking.patientNameMasked}</b>
                    <span>
                      {formatDayMonth(clinicDate(booking.startsAt, timeZone))}, {booking.localTime} · {booking.doctor.name}
                    </span>
                    <small>Booked {bookedAgo(booking.bookedAt, clinicClock.now())}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">You are all caught up.</p>
          )}
        </section>
      ) : null}
    </span>
  );
}
