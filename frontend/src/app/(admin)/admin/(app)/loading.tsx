import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/**
 * The Overview while it loads: the same frame as the finished page (greeting, six KPI cards, the agenda and the two
 * lists), so nothing moves when the real content arrives.
 */
export default function OverviewLoading() {
  return (
    <LoadingRegion label="Loading the overview">
      <div className="page-head">
        <div>
          <Skeleton width={260} height={34} />
          <Skeleton width={200} height={14} style={{ marginTop: 10 }} />
        </div>
      </div>
      <section className="kpis" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="card kpi">
            <Skeleton width={90} height={12} />
            <Skeleton width={64} height={34} style={{ marginTop: 12 }} />
            <Skeleton width={110} height={14} style={{ marginTop: 12 }} />
          </div>
        ))}
      </section>
      <section className="card agenda" aria-hidden="true" style={{ padding: 18 }}>
        <Skeleton width={180} height={20} />
        <Skeleton height={190} style={{ marginTop: 16 }} />
      </section>
      <div className="grid-2" aria-hidden="true">
        <section className="card" style={{ padding: 18 }}>
          <Skeleton width={160} height={20} />
          <Skeleton height={56} style={{ marginTop: 14 }} />
          <Skeleton height={56} style={{ marginTop: 10 }} />
        </section>
        <section className="card" style={{ padding: 18 }}>
          <Skeleton width={140} height={20} />
          <Skeleton height={14} style={{ marginTop: 18 }} />
          <Skeleton height={110} style={{ marginTop: 14 }} />
        </section>
      </div>
    </LoadingRegion>
  );
}
