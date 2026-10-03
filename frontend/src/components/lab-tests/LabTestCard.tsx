import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { getCategoryAccent } from "@/lib/categoryAccent";
import { cn } from "@/lib/cn";
import { formatPkr } from "@/lib/format";
import { labTestPath } from "@/lib/routes";
import type { LabTest, LabTestCategory } from "@/types/content";

interface LabTestCardProps {
  test: LabTest;
  /** Shows the category icon and name when given. */
  category?: LabTestCategory;
  /** Name, price and report time only (department pages). */
  compact?: boolean;
}

/**
 * A sample lab test: name, price (always labelled as a sample price), sample type, report time,
 * preparation and home collection. The name is the one link, stretched over the card.
 */
export function LabTestCard({ test, category, compact = false }: LabTestCardProps) {
  const accent = category ? getCategoryAccent(category.slug) : undefined;
  return (
    <Card as="article" interactive className={cn("flex w-full flex-col p-5", accent && cn("border-t-4", accent.bar))}>
      <div className="flex items-start gap-3">
        {category ? <IconTile name={category.iconName} tint={accent?.tint} /> : null}
        <div className="min-w-0">
          {category ? <p className="text-sm font-semibold text-teal-700">{category.name}</p> : null}
          <h3 className="text-lg font-bold">
            <Link href={labTestPath(test.slug)} className="after:absolute after:inset-0 after:rounded-card">
              {test.name}
            </Link>
          </h3>
          {!compact && test.alsoKnownAs.length > 0 ? (
            <p className="mt-1 text-sm text-muted">Also known as: {test.alsoKnownAs.join(", ")}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        <span className="text-xl font-bold text-navy-900">{formatPkr(test.pricePkr)}</span> <span>Sample price</span>
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {compact ? null : (
          <>
            <dt className="text-muted">Sample</dt>
            <dd className="font-medium text-ink">{test.sampleType}</dd>
          </>
        )}
        <dt className="text-muted">Report</dt>
        <dd className="font-medium text-ink">{test.reportTime}</dd>
        {compact ? null : (
          <>
            <dt className="text-muted">Preparation</dt>
            <dd className="font-medium text-ink">{test.preparation}</dd>
            <dt className="text-muted">Home collection</dt>
            <dd className="font-medium text-ink">{test.homeCollection ? "Yes" : "No"}</dd>
          </>
        )}
      </dl>

      <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-teal-700">
        View details
        <ArrowRight className="size-4" />
      </span>
    </Card>
  );
}
