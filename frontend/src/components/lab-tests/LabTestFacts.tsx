import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatPkr } from "@/lib/format";
import type { LabTest, LabTestCategory } from "@/types/content";

/** The facts about one sample lab test, as a definition list, with the price always labelled as a sample. */
export function LabTestFacts({ test, category }: { test: LabTest; category?: LabTestCategory }) {
  return (
    <div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {category ? (
          <div>
            <dt className="text-sm text-muted">Category</dt>
            <dd className="text-base font-semibold text-navy-900">{category.name}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-muted">Price</dt>
          <dd className="flex flex-wrap items-center gap-2 text-base font-semibold text-navy-900">
            {formatPkr(test.pricePkr)}
            <SampleBadge label="Sample price" />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Sample type</dt>
          <dd className="text-base font-semibold text-navy-900">{test.sampleType}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Report time</dt>
          <dd className="text-base font-semibold text-navy-900">{test.reportTime}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Preparation</dt>
          <dd className="text-base font-semibold text-navy-900">{test.preparation}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Home collection</dt>
          <dd className="text-base font-semibold text-navy-900">{test.homeCollection ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <p className="mt-6 max-w-2xl text-sm text-muted">
        Follow your doctor&apos;s instructions about preparation. This page describes the test only; it does not explain results, and your
        doctor is the right person to do that.
      </p>
    </div>
  );
}
