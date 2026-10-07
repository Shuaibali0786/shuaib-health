import type { Metadata } from "next";

import { InsightsView, RangeSwitch } from "@/admin/charts/InsightsView";
import { formatDayMonth } from "@/admin/lib/format";
import { InsightsSchema } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";
import { ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const RANGES = ["7", "30", "90"];

/** Bookings per day, by department, by status and by hour. The range is in the address; the charts are drawn on the server. */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { range } = await searchParams;
  const days = RANGES.includes(range ?? "") ? (range as string) : "30";

  const response = await adminGet(`insights?range=${days}`).catch(() => null);
  const parsed = response?.status === 200 ? InsightsSchema.safeParse(response.body) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <div className="sub">{parsed?.success ? `${formatDayMonth(parsed.data.from)} to ${formatDayMonth(parsed.data.to)}, clinic time. Cancelled bookings are counted apart.` : "How the clinic is booked."}</div>
        </div>
      </div>
      <RangeSwitch current={Number(days)} />
      {parsed?.success ? <InsightsView data={parsed.data} /> : <ErrorState title="We could not load the insights">Please reload the page in a moment.</ErrorState>}
    </>
  );
}
