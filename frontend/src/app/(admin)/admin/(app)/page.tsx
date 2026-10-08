import type { Metadata } from "next";

import { OverviewScreen } from "@/admin/overview/OverviewScreen";
import { OverviewSchema } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";
import { greeting } from "@/admin/lib/format";
import { ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * Today at a glance. The first answer is fetched and rendered here, so the page is complete before any
 * script runs; the client island takes over for the 30 s refresh, the moving "Now" line and the live
 * counts. A viewer who is not signed in never gets here (the layout redirects).
 */
export default async function OverviewPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  const first = viewer.displayName?.split(" ")[0];

  const response = await adminGet("overview").catch(() => null);
  const overview = response?.status === 200 ? OverviewSchema.safeParse(response.body) : null;

  if (!overview?.success) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="display">{greeting(new Date(), viewer.timezone)}</h1>
          </div>
        </div>
        <ErrorState title="We could not load the overview">Please reload the page in a moment.</ErrorState>
      </>
    );
  }

  return <OverviewScreen initial={overview.data} demo={viewer.kind === "demo"} firstName={first} timeZone={viewer.timezone} serverNow={overview.data.now} />;
}
