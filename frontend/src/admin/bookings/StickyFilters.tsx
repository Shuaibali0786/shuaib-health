"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import type { BookingFilters } from "@/admin/lib/bookingsUrl";
import type { BookingStatus, Lookups } from "@/admin/lib/schemas";
import { Dialog } from "@/admin/ui/Dialog";

import { DateField, DoctorAndDepartment, SearchField, StatusChips, dateLabel, type FilterChange } from "./FilterBar";

/**
 * The phone filters: a sticky search field with a Filters button (date, doctor, department in a sheet)
 * and a row of scrolling status chips under it.
 */
export function StickyFilters({ filters, lookups, today, counts, total, onChange }: { filters: BookingFilters; lookups: Lookups | null; today: string; counts: Partial<Record<BookingStatus, number>>; total: number; onChange: FilterChange }) {
  const [open, setOpen] = useState(false);
  const active = [filters.from || filters.to ? 1 : 0, filters.doctor ? 1 : 0, filters.department ? 1 : 0].reduce((a, b) => a + b, 0);
  const toggle = (status: BookingStatus) => onChange({ statuses: filters.statuses.includes(status) ? filters.statuses.filter((s) => s !== status) : [...filters.statuses, status], page: 1 });
  return (
    <div className="m-filters">
      <div className="row">
        <SearchField value={filters.q} onChange={(q) => onChange({ q, page: 1 })} placeholder="Reference or name" />
        <button type="button" className="btn" onClick={() => setOpen(true)} aria-label={active ? `Filters, ${active} active` : "Filters"}>
          <SlidersHorizontal className="i i-sm" aria-hidden="true" />
          {active ? dateLabel(filters, today).split(",")[0] : "Today"}
        </button>
      </div>
      <StatusChips counts={counts} total={total} statuses={filters.statuses} onToggle={toggle} onAll={() => onChange({ statuses: [], page: 1 })} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        actions={
          <>
            <button type="button" className="btn" onClick={() => onChange({ from: null, to: null, doctor: null, department: null, statuses: [], page: 1 })}>
              Clear
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)} data-initial-focus="">
              Show {total} bookings
            </button>
          </>
        }
      >
        <div className="sheet-fields">
          <DateField filters={filters} today={today} onChange={onChange} />
          <DoctorAndDepartment lookups={lookups} filters={filters} onChange={onChange} />
        </div>
      </Dialog>
    </div>
  );
}
