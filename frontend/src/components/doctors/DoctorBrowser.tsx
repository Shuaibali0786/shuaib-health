"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DoctorList } from "@/components/doctors/DoctorList";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar, ResultCount, SearchField, SelectField } from "@/components/ui/FilterBar";
import {
  doctorFiltersToQuery,
  filterDoctors,
  FILTER_WEEKDAYS,
  hasDoctorFilters,
  NO_DOCTOR_FILTERS,
  parseDoctorFilters,
  type DoctorFilters,
} from "@/lib/filters";
import { formatDayLong } from "@/lib/format";
import type { Department, Doctor } from "@/types/content";

type DepartmentOption = Pick<Department, "id" | "slug" | "name">;

interface DoctorBrowserProps {
  doctors: Doctor[];
  departments: DepartmentOption[];
}

/** The three controls. Also used, inert, by the server-rendered fallback so nothing jumps on hydration. */
export function DoctorFilterControls({
  filters,
  departments,
  onChange,
}: {
  filters: DoctorFilters;
  departments: DepartmentOption[];
  onChange: (next: DoctorFilters) => void;
}) {
  return (
    <FilterBar label="Filter doctors">
      <SearchField
        id="doctor-search"
        label="Search by name"
        value={filters.query}
        placeholder="For example Sana"
        onChange={(query) => onChange({ ...filters, query })}
      />
      <SelectField
        id="doctor-department"
        label="Department"
        value={filters.departmentId}
        onChange={(departmentId) => onChange({ ...filters, departmentId })}
        options={[{ value: "", label: "All departments" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
      />
      <SelectField
        id="doctor-day"
        label="Available on"
        value={filters.day}
        onChange={(day) => onChange({ ...filters, day: FILTER_WEEKDAYS.find((candidate) => candidate === day) ?? "" })}
        options={[{ value: "", label: "Any day" }, ...FILTER_WEEKDAYS.map((day) => ({ value: day, label: formatDayLong(day) }))]}
      />
    </FilterBar>
  );
}

/**
 * What the server renders (and what shows while the filter island loads): the same controls, not
 * yet active, above the full list. Same layout as the real thing, so nothing jumps on hydration.
 */
export function DoctorBrowserFallback({ doctors, departments }: DoctorBrowserProps) {
  return (
    <div className="flex flex-col gap-6">
      <DoctorFilterControls filters={NO_DOCTOR_FILTERS} departments={departments} onChange={() => {}} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount shown={doctors.length} total={doctors.length} noun="doctors" />
      </div>
      <DoctorList doctors={doctors} />
    </div>
  );
}

/**
 * The Doctors list with filters. Filters live in the URL (?department=&q=&day=), so they survive
 * going back from a profile and can be shared. Filtering runs in the browser on the sample data:
 * no network request is made.
 */
export function DoctorBrowser({ doctors, departments }: DoctorBrowserProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<DoctorFilters>(() => parseDoctorFilters((key) => searchParams.get(key), departments));

  function update(next: DoctorFilters) {
    setFilters(next);
    const query = doctorFiltersToQuery(next, departments);
    window.history.replaceState(window.history.state, "", query ? `?${query}` : window.location.pathname);
  }

  const shown = filterDoctors(doctors, filters);

  return (
    // data-filters-ready marks the live island (not the server fallback), so tests know the controls work.
    <div className="flex flex-col gap-6" data-filters-ready="true">
      <DoctorFilterControls filters={filters} departments={departments} onChange={update} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount shown={shown.length} total={doctors.length} noun="doctors" />
        {hasDoctorFilters(filters) && shown.length > 0 ? (
          <button
            type="button"
            onClick={() => update(NO_DOCTOR_FILTERS)}
            className="min-h-6 text-sm font-semibold text-teal-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {shown.length > 0 ? (
        <DoctorList doctors={shown} />
      ) : (
        <EmptyState
          title="No doctors match your filters"
          description="Try another department or day, or search by a different name."
          onClear={() => update(NO_DOCTOR_FILTERS)}
        />
      )}
    </div>
  );
}
