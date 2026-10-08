import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** Insights while it loads: the heading and the shapes of the charts. */
export default function InsightsLoading() {
  return (
    <LoadingRegion label="Loading the insights">
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <div className="sub">How the clinic is booked.</div>
        </div>
      </div>
      <div className="insights-grid" aria-hidden="true">
        <section className="card span-2" style={{ padding: 18 }}>
          <Skeleton width={160} height={20} />
          <Skeleton height={180} style={{ marginTop: 14 }} />
        </section>
        <section className="card" style={{ padding: 18 }}>
          <Skeleton width={120} height={20} />
          <Skeleton height={120} style={{ marginTop: 14 }} />
        </section>
        <section className="card" style={{ padding: 18 }}>
          <Skeleton width={120} height={20} />
          <Skeleton height={120} style={{ marginTop: 14 }} />
        </section>
      </div>
    </LoadingRegion>
  );
}
