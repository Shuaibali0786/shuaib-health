import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** The Staff screen while it loads: the heading and the list of people. */
export default function StaffLoading() {
  return (
    <LoadingRegion label="Loading the staff list">
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <div className="sub">Who can sign in, and what they can do.</div>
        </div>
      </div>
      <section className="card" aria-hidden="true" style={{ padding: 18 }}>
        <Skeleton width={180} height={20} />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} height={56} style={{ marginTop: 12 }} />
        ))}
      </section>
    </LoadingRegion>
  );
}
