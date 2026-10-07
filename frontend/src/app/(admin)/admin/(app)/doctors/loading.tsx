import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** Doctors today while it loads: the heading and a row of cards. */
export default function DoctorsLoading() {
  return (
    <LoadingRegion label="Loading today's doctors">
      <div className="page-head">
        <div>
          <h1>Doctors today</h1>
        </div>
      </div>
      <div className="doc-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <section key={index} className="card" style={{ padding: 18 }}>
            <Skeleton width={160} height={20} />
            <Skeleton height={80} style={{ marginTop: 14 }} />
          </section>
        ))}
      </div>
    </LoadingRegion>
  );
}
