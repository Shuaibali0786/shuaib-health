import type { Metadata } from "next";

import { BookingsScreen } from "@/admin/bookings/BookingsScreen";
import { filtersToBody, parseFilters } from "@/admin/lib/bookingsUrl";
import { BookingPageSchema, LookupsSchema } from "@/admin/lib/schemas";
import { adminGet, adminPostRead, getViewer } from "@/admin/lib/server";
import { ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

/**
 * Bookings. The first page is rendered here from the address (only dates, doctor, department, status and
 * page are read from it, never search text); everything after that happens in the client island.
 */
export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  const filters = parseFilters(await searchParams);

  const [pageResponse, lookupsResponse] = await Promise.all([adminPostRead("bookings/search", filtersToBody(filters), viewer.csrfToken).catch(() => null), adminGet("lookups").catch(() => null)]);
  const page = pageResponse?.status === 200 ? BookingPageSchema.safeParse(pageResponse.body) : null;
  const lookups = lookupsResponse?.status === 200 ? LookupsSchema.safeParse(lookupsResponse.body) : null;

  if (!page?.success) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Bookings</h1>
          </div>
        </div>
        <ErrorState title="We could not load the bookings">Please reload the page in a moment.</ErrorState>
      </>
    );
  }

  return (
    <BookingsScreen
      initialPage={page.data}
      lookups={lookups?.success ? lookups.data : null}
      initialFilters={filters}
      demo={viewer.kind === "demo"}
      clinicToday={viewer.clinicToday}
      timeZone={viewer.timezone}
      serverNow={new Date().toISOString()}
    />
  );
}
