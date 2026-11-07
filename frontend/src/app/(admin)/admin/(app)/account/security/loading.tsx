import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** The security page while it loads. */
export default function SecurityLoading() {
  return (
    <LoadingRegion label="Loading">
      <div className="page-head">
        <div>
          <Skeleton width={220} height={30} />
        </div>
      </div>
      <section className="card" aria-hidden="true" style={{ padding: 18, maxWidth: 520 }}>
        <Skeleton height={44} />
        <Skeleton height={44} style={{ marginTop: 14 }} />
        <Skeleton height={44} style={{ marginTop: 14 }} />
        <Skeleton width={140} height={44} style={{ marginTop: 18 }} />
      </section>
    </LoadingRegion>
  );
}
