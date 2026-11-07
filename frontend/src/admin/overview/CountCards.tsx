"use client";

import { Ban, CalendarClock, CalendarDays, CalendarRange, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { addDays } from "@/admin/lib/quickRanges";
import type { OverviewCards } from "@/admin/lib/schemas";
import { useBell } from "@/admin/state/bell";

import { CountUp } from "./CountUp";

type Card = { id: string; label: string; value: number; icon: LucideIcon; href: string; hint: string };

/** Monday and Sunday of the clinic-local week that contains `today` (`YYYY-MM-DD`). */
export function weekOf(today: string): { monday: string; sunday: string } {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const monday = addDays(today, -((weekday + 6) % 7));
  return { monday, sunday: addDays(monday, 6) };
}

/**
 * Today, Tomorrow, Next 7 days, New since last visit and Cancelled this week (Feature 012). Each card opens the
 * Bookings list for exactly what it counts. Today follows the live KPI so the two never disagree; "New" follows
 * the bell, which knows what this person has just opened.
 */
export function CountCards({ cards, today, todayLive }: { cards: OverviewCards; today: string; todayLive: number | null }) {
  const fresh = useBell().view?.count ?? cards.newSinceLastVisit;
  const { monday, sunday } = weekOf(today);
  const tomorrow = addDays(today, 1);
  const list: Card[] = [
    { id: "today", label: "Today", value: todayLive ?? cards.today, icon: CalendarDays, href: "/admin/bookings", hint: "Bookings today that are not cancelled" },
    { id: "tomorrow", label: "Tomorrow", value: cards.tomorrow, icon: CalendarClock, href: `/admin/bookings?from=${tomorrow}&to=${tomorrow}`, hint: "Bookings tomorrow that are not cancelled" },
    { id: "next7", label: "Next 7 days", value: cards.next7Days, icon: CalendarRange, href: `/admin/bookings?from=${tomorrow}&to=${addDays(today, 7)}`, hint: "The seven days after today, not cancelled" },
    { id: "new", label: "New since last visit", value: fresh, icon: Sparkles, href: "/admin/bookings?view=upcoming&sort=recent", hint: "Booked since you last marked all seen, and not opened by you" },
    { id: "cancelled", label: "Cancelled this week", value: cards.cancelledThisWeek, icon: Ban, href: `/admin/bookings?from=${monday}&to=${sunday}&status=cancelled`, hint: "Cancelled bookings dated this Monday to Sunday" },
  ];
  return (
    <section className="count-cards" aria-label="Upcoming bookings at a glance">
      {list.map(({ id, label, value, icon: Icon, href, hint }) => (
        <Link key={id} href={href} prefetch={false} className="card count-card" data-count={id} title={hint}>
          <span className="label">
            <Icon className="i i-sm" aria-hidden="true" />
            {label}
          </span>
          <span className="value">
            <CountUp value={value} />
          </span>
        </Link>
      ))}
    </section>
  );
}
