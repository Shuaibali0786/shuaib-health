import type { Metadata } from "next";

import { formatLongDate, greeting } from "@/admin/lib/format";
import { getViewer } from "@/admin/lib/server";
import { EmptyState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

// The shell is in place; the Overview itself (KPIs, agenda, next patients) arrives with its own story.
export default async function OverviewPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  const first = viewer.displayName?.split(" ")[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{first ? `${greeting(new Date(), viewer.timezone)}, ${first}` : greeting(new Date(), viewer.timezone)}</h1>
          <div className="sub">{formatLongDate(viewer.clinicToday)}</div>
        </div>
      </div>
      <div className="card">
        <EmptyState title="Today at a glance">Your appointments, arrivals and next patients will appear here.</EmptyState>
      </div>
    </>
  );
}
