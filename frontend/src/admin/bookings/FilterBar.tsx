"use client";

import { CalendarDays, ChevronDown, Search } from "lucide-react";
import { useId, type ReactNode } from "react";

import { formatDayMonth } from "@/admin/lib/format";
import type { BookingFilters } from "@/admin/lib/bookingsUrl";
import type { BookingStatus, Lookups } from "@/admin/lib/schemas";
import { STATUS_LABEL } from "@/admin/lib/statusRules";

import { STATUS_ICON } from "./StatusBadge";

const ORDER: BookingStatus[] = ["confirmed", "arrived", "completed", "no_show", "cancelled"];

export type FilterChange = (patch: Partial<BookingFilters>) => void;

/** "Today, 5 Oct" for the clinic's today, else "Mon 12 Oct" (one day) or "5 Oct – 9 Oct". */
export function dateLabel(filters: Pick<BookingFilters, "from" | "to">, today: string): string {
  const from = filters.from ?? filters.to ?? today;
  const to = filters.to ?? from;
  const short = (date: string) => formatDayMonth(date).replace(/^\w+ /, "");
  if (from === to) return from === today ? `Today, ${short(today)}` : formatDayMonth(from);
  return `${short(from)} – ${short(to)}`;
}

export function StatusChips({ counts, total, statuses, onToggle, onAll }: { counts: Partial<Record<BookingStatus, number>>; total: number; statuses: BookingStatus[]; onToggle: (status: BookingStatus) => void; onAll: () => void }) {
  return (
    <div className="chips" role="group" aria-label="Status">
      <button type="button" className="chip" aria-pressed={statuses.length === 0} onClick={onAll}>
        All <span className="c">{total}</span>
      </button>
      {ORDER.map((status) => {
        const Icon = STATUS_ICON[status];
        return (
          <button key={status} type="button" className="chip" aria-pressed={statuses.includes(status)} onClick={() => onToggle(status)}>
            <Icon className="i i-sm" aria-hidden="true" />
            {STATUS_LABEL[status]} <span className="c">{counts[status] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search reference or patient name" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field search">
      <Search className="i i-sm" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        Search reference or patient name
      </label>
      <input id={id} type="search" value={value} maxLength={80} placeholder={placeholder} autoComplete="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function DateField({ filters, today, onChange }: { filters: BookingFilters; today: string; onChange: FilterChange }) {
  const id = useId();
  return (
    <div className="field">
      <CalendarDays className="i i-sm" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        Date
      </label>
      <input id={id} type="date" value={filters.from ?? filters.to ?? today} onChange={(event) => event.target.value && onChange({ from: event.target.value, to: event.target.value, page: 1 })} />
      <span className="val" aria-hidden="true">
        {dateLabel(filters, today)}
      </span>
    </div>
  );
}

export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <ChevronDown className="i i-sm chev" aria-hidden="true" />
    </div>
  );
}

export function DoctorAndDepartment({ lookups, filters, onChange }: { lookups: Lookups | null; filters: BookingFilters; onChange: FilterChange }) {
  return (
    <>
      <SelectField label="Doctor" value={filters.doctor ?? ""} onChange={(value) => onChange({ doctor: value || null, page: 1 })}>
        <option value="">All doctors</option>
        {lookups?.doctors.map((doctor) => (
          <option key={doctor.id} value={doctor.id}>
            {doctor.name}
            {doctor.isActive === false ? " (inactive)" : ""}
          </option>
        ))}
      </SelectField>
      <SelectField label="Department" value={filters.department ?? ""} onChange={(value) => onChange({ department: value || null, page: 1 })}>
        <option value="">All departments</option>
        {lookups?.departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
            {department.isActive === false ? " (inactive)" : ""}
          </option>
        ))}
      </SelectField>
    </>
  );
}

/** Desktop filters: search, date, doctor, department, then the status chips with counts. */
export function FilterBar({ filters, lookups, today, counts, total, onChange }: { filters: BookingFilters; lookups: Lookups | null; today: string; counts: Partial<Record<BookingStatus, number>>; total: number; onChange: FilterChange }) {
  const toggle = (status: BookingStatus) => onChange({ statuses: filters.statuses.includes(status) ? filters.statuses.filter((s) => s !== status) : [...filters.statuses, status], page: 1 });
  return (
    <>
      <div className="filters">
        <SearchField value={filters.q} onChange={(q) => onChange({ q, page: 1 })} />
        <DateField filters={filters} today={today} onChange={onChange} />
        <DoctorAndDepartment lookups={lookups} filters={filters} onChange={onChange} />
      </div>
      <div className="chips-slot">
        <StatusChips counts={counts} total={total} statuses={filters.statuses} onToggle={toggle} onAll={() => onChange({ statuses: [], page: 1 })} />
      </div>
    </>
  );
}
