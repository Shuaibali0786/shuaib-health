"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LabTestCard } from "@/components/lab-tests/LabTestCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChipGroup, FilterBar, ResultCount, SearchField } from "@/components/ui/FilterBar";
import {
  filterLabTests,
  hasLabTestFilters,
  labTestFiltersToQuery,
  NO_LAB_TEST_FILTERS,
  parseLabTestFilters,
  type LabTestFilters,
} from "@/lib/filters";
import type { LabTest, LabTestCategory } from "@/types/content";

interface LabTestBrowserProps {
  tests: LabTest[];
  categories: LabTestCategory[];
}

/** The search box and the category chips. Also used, inert, by the server-rendered fallback. */
export function LabTestFilterControls({
  filters,
  tests,
  categories,
  onChange,
}: LabTestBrowserProps & { filters: LabTestFilters; onChange: (next: LabTestFilters) => void }) {
  return (
    <FilterBar label="Filter lab tests" className="sm:flex-col sm:items-stretch">
      <SearchField
        id="lab-test-search"
        label="Search tests"
        value={filters.query}
        placeholder="For example sugar, HbA1c or CBC"
        onChange={(query) => onChange({ ...filters, query })}
      />
      <ChipGroup
        label="Category"
        value={filters.categoryId}
        onChange={(categoryId) => onChange({ ...filters, categoryId })}
        options={[
          { value: "", label: "All", count: tests.length },
          ...categories.map((category) => ({
            value: category.id,
            label: category.name,
            count: tests.filter((test) => test.categoryId === category.id).length,
            iconName: category.iconName,
          })),
        ]}
      />
    </FilterBar>
  );
}

function LabTestList({ tests, categories }: LabTestBrowserProps) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((test) => (
        <li key={test.id} className="flex">
          <LabTestCard test={test} category={categories.find((category) => category.id === test.categoryId)} />
        </li>
      ))}
    </ul>
  );
}

/** What the server renders (and shows while the filter island loads): the same controls above the full catalog. */
export function LabTestBrowserFallback({ tests, categories }: LabTestBrowserProps) {
  return (
    <div className="flex flex-col gap-6">
      <LabTestFilterControls filters={NO_LAB_TEST_FILTERS} tests={tests} categories={categories} onChange={() => {}} />
      <ResultCount shown={tests.length} total={tests.length} noun="lab tests" />
      <LabTestList tests={tests} categories={categories} />
    </div>
  );
}

/**
 * The lab test catalog with search and category filter. Filters live in the URL (?category=&q=),
 * so they survive going back from a test page. Filtering runs in the browser on the sample data:
 * no network request is made.
 */
export function LabTestBrowser({ tests, categories }: LabTestBrowserProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<LabTestFilters>(() => parseLabTestFilters((key) => searchParams.get(key), categories));

  function update(next: LabTestFilters) {
    setFilters(next);
    const query = labTestFiltersToQuery(next, categories);
    window.history.replaceState(window.history.state, "", query ? `?${query}` : window.location.pathname);
  }

  const shown = filterLabTests(tests, filters);

  return (
    // data-filters-ready marks the live island (not the server fallback), so tests know the controls work.
    <div className="flex flex-col gap-6" data-filters-ready="true">
      <LabTestFilterControls filters={filters} tests={tests} categories={categories} onChange={update} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount shown={shown.length} total={tests.length} noun="lab tests" />
        {hasLabTestFilters(filters) && shown.length > 0 ? (
          <button
            type="button"
            onClick={() => update(NO_LAB_TEST_FILTERS)}
            className="min-h-6 text-sm font-semibold text-teal-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {shown.length > 0 ? (
        <LabTestList tests={shown} categories={categories} />
      ) : (
        <EmptyState
          title="No lab tests match your search"
          description="Try another category, or search by a different name such as sugar, thyroid or CBC."
          onClear={() => update(NO_LAB_TEST_FILTERS)}
        />
      )}
    </div>
  );
}
