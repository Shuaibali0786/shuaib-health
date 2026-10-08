import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** The Activity feed while it loads: the heading and rows. */
export default function ActivityLoading() {
  return (
    <LoadingRegion label="Loading the activity">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
        </div>
      </div>
      <section className="card" aria-hidden="true" style={{ padding: 18 }}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={44} style={{ marginTop: index ? 10 : 0 }} />
        ))}
      </section>
    </LoadingRegion>
  );
}
