"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { TipCard } from "@/components/home/TipCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChipGroup, FilterBar, ResultCount } from "@/components/ui/FilterBar";
import { filterTips, hasTipFilters, NO_TIP_FILTERS, parseTipFilters, tipFiltersToQuery, type TipFilters } from "@/lib/filters";
import type { HealthTip } from "@/types/content";

interface TipBrowserProps {
  tips: HealthTip[];
  categories: string[];
}

/** The category chips. Also used, inert, by the server-rendered fallback so nothing jumps on hydration. */
function TipFilterControls({ filters, tips, categories, onChange }: TipBrowserProps & { filters: TipFilters; onChange: (next: TipFilters) => void }) {
  return (
    <FilterBar label="Filter health tips">
      <ChipGroup
        label="Category"
        value={filters.category}
        onChange={(category) => onChange({ category })}
        options={[
          { value: "", label: "All", count: tips.length },
          ...categories.map((category) => ({ value: category, label: category, count: tips.filter((tip) => tip.category === category).length })),
        ]}
      />
    </FilterBar>
  );
}

function TipList({ tips }: { tips: HealthTip[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tips.map((tip) => (
        <li key={tip.id} className="flex">
          <TipCard tip={tip} showMeta />
        </li>
      ))}
    </ul>
  );
}

/** What the server renders (and shows while the filter island loads): the same chips above every article. */
export function TipBrowserFallback({ tips, categories }: TipBrowserProps) {
  return (
    <div className="flex flex-col gap-6">
      <TipFilterControls filters={NO_TIP_FILTERS} tips={tips} categories={categories} onChange={() => {}} />
      <ResultCount shown={tips.length} total={tips.length} noun="articles" />
      <TipList tips={tips} />
    </div>
  );
}

/**
 * The Health Tips list with a category filter. The filter lives in the URL (?category=), so it
 * survives going back from an article. Filtering runs in the browser on the sample data.
 */
export function TipBrowser({ tips, categories }: TipBrowserProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TipFilters>(() => parseTipFilters((key) => searchParams.get(key), categories));

  function update(next: TipFilters) {
    setFilters(next);
    const query = tipFiltersToQuery(next);
    window.history.replaceState(window.history.state, "", query ? `?${query}` : window.location.pathname);
  }

  const shown = filterTips(tips, filters);

  return (
    // data-filters-ready marks the live island (not the server fallback), so tests know the controls work.
    <div className="flex flex-col gap-6" data-filters-ready="true">
      <TipFilterControls filters={filters} tips={tips} categories={categories} onChange={update} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultCount shown={shown.length} total={tips.length} noun="articles" />
        {hasTipFilters(filters) && shown.length > 0 ? (
          <button
            type="button"
            onClick={() => update(NO_TIP_FILTERS)}
            className="min-h-6 text-sm font-semibold text-teal-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {shown.length > 0 ? (
        <TipList tips={shown} />
      ) : (
        <EmptyState title="No articles in this category" description="Choose another category to see more articles." onClear={() => update(NO_TIP_FILTERS)} />
      )}
    </div>
  );
}
