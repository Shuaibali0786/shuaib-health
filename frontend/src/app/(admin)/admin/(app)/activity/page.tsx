import type { Metadata } from "next";

import { ActivityFeed } from "@/admin/activity/ActivityFeed";
import { ActivityPageSchema, StaffListSchema } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";
import { UUID } from "@/admin/lib/bffRoutes";
import { EmptyState, ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

function Refusal() {
  return (
    <div className="card">
      <EmptyState title="You do not have access to this page">The activity feed is for administrators.</EmptyState>
    </div>
  );
}

type Search = { action?: string; staffId?: string; page?: string };

/** Security and operational events for admins; the demo shows a synthetic feed. Filters and page are in the address. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  // The backend refuses non-admins too; checking here only avoids a request that cannot succeed.
  if (viewer.kind !== "demo" && viewer.role !== "admin") return <Refusal />;

  const search = await searchParams;
  const action = search.action && /^[a-z_]+\.[a-z_]+$/.test(search.action) ? search.action : undefined;
  const staffId = search.staffId && UUID.test(search.staffId) ? search.staffId : undefined;
  const page = search.page && /^\d{1,4}$/.test(search.page) && Number(search.page) >= 1 ? Number(search.page) : 1;
  const query = new URLSearchParams();
  if (action) query.set("action", action);
  if (staffId) query.set("staffId", staffId);
  if (page > 1) query.set("page", String(page));

  const [feed, people] = await Promise.all([adminGet(`activity${query.size ? `?${query}` : ""}`).catch(() => null), adminGet("staff").catch(() => null)]);
  if (feed?.status === 403) return <Refusal />;
  const parsed = feed?.status === 200 ? ActivityPageSchema.safeParse(feed.body) : null;
  const staff = people?.status === 200 ? StaffListSchema.safeParse(people.body) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <div className="sub">Sign-ins, status changes, undos and phone reveals, newest first. No patient details are kept here.</div>
        </div>
      </div>
      {parsed?.success ? (
        <ActivityFeed data={parsed.data} staff={staff?.success ? staff.data : []} action={action} staffId={staffId} sample={viewer.kind === "demo"} />
      ) : (
        <ErrorState title="We could not load the activity">Please reload the page in a moment.</ErrorState>
      )}
    </>
  );
}
