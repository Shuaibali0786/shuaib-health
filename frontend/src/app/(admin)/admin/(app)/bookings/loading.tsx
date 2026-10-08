import { LoadingRegion, Skeleton } from "@/admin/ui/States";

/** The Bookings screen while it loads: the heading, a filter bar and a list of rows. */
export default function BookingsLoading() {
  return (
    <LoadingRegion label="Loading the bookings">
      <div className="page-head">
        <div>
          <h1>Bookings</h1>
          <Skeleton width={240} height={14} style={{ marginTop: 8 }} />
        </div>
      </div>
      <section className="card" aria-hidden="true" style={{ padding: 18 }}>
        <Skeleton height={44} />
        <Skeleton width={320} height={34} style={{ marginTop: 14 }} />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} height={52} style={{ marginTop: 10 }} />
        ))}
      </section>
    </LoadingRegion>
  );
}
