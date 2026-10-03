import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatPkr } from "@/lib/format";
import type { PackageSummary } from "@/lib/packages";
import { labTestPath, ROUTES } from "@/lib/routes";
import type { HealthPackage } from "@/types/content";

interface PackageCardProps {
  pkg: HealthPackage;
  /** `null` when the lab test catalog is unavailable: the test names and the sums are left out. */
  summary: PackageSummary | null;
}

/**
 * One sample health package: who it is for, the included tests (each a link to its catalog page),
 * three price rows (sum of the tests, package price, difference in PKR), preparation and home
 * collection. Prices are always labelled as samples; there are no percentages or promotional words.
 */
export function PackageCard({ pkg, summary }: PackageCardProps) {
  const titleId = `package-${pkg.slug}`;
  return (
    <Card as="article" aria-labelledby={titleId} className="flex h-full w-full flex-col p-6">
      <div className="flex items-start gap-3">
        <IconTile name={pkg.iconName} />
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-bold">
            {pkg.name}
          </h2>
          <p className="mt-1 text-base text-muted">{pkg.whoFor}</p>
        </div>
      </div>

      {summary ? (
        <>
          <h3 className="mt-6 text-base font-bold text-navy-900">Included tests ({summary.tests.length})</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {summary.tests.map((test) => (
              <li key={test.slug}>
                <Link
                  href={labTestPath(test.slug)}
                  className="inline-flex min-h-6 items-center text-base font-medium text-teal-700 underline underline-offset-2"
                >
                  {test.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <dl className="mt-6 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 border-t border-border pt-4 text-base">
        {summary ? (
          <>
            <dt className="text-muted">Sum of individual tests</dt>
            <dd className="text-right font-semibold text-navy-900">{formatPkr(summary.sumPkr)}</dd>
            <dt className="text-muted">Difference</dt>
            <dd className="text-right font-semibold text-navy-900">{formatPkr(summary.savingPkr)}</dd>
          </>
        ) : null}
        <dt className="mt-2 rounded-l-control bg-teal-50 px-3 py-3 text-base font-semibold text-navy-900">Package price</dt>
        <dd className="mt-2 rounded-r-control bg-teal-50 px-3 py-2 text-right text-2xl font-bold text-navy-900">
          {formatPkr(pkg.packagePricePkr)}
        </dd>
      </dl>
      <div className="mt-2">
        <SampleBadge label="Sample price" />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Preparation</dt>
        <dd className="font-medium text-ink">{pkg.preparation}</dd>
        <dt className="text-muted">Home collection</dt>
        <dd className="font-medium text-ink">{pkg.homeCollection ? "Yes" : "No"}</dd>
      </dl>

      <Button
        href={ROUTES.bookAppointment}
        variant="accent"
        fullWidth
        className="mt-6 self-stretch"
        aria-label={`Book this package: ${pkg.name}`}
      >
        Book this package
      </Button>
    </Card>
  );
}
