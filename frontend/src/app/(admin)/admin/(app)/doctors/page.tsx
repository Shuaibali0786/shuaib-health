import type { Metadata } from "next";

import { DoctorTodayCard } from "@/admin/doctors/DoctorTodayCard";
import { formatLongDate } from "@/admin/lib/format";
import { DoctorsTodaySchema } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";
import { EmptyState, ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Doctors today" };
export const dynamic = "force-dynamic";

/** Who is in today, with booked and free slots; doctors on leave and not in today are listed apart. */
export default async function DoctorsPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;

  const response = await adminGet("doctors-today").catch(() => null);
  const parsed = response?.status === 200 ? DoctorsTodaySchema.safeParse(response.body) : null;

  if (!parsed?.success) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Doctors today</h1>
          </div>
        </div>
        <ErrorState title="We could not load today's doctors">Please reload the page in a moment.</ErrorState>
      </>
    );
  }
  const data = parsed.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Doctors today</h1>
          <div className="sub">{formatLongDate(data.localDate)}. Ordered by who has a slot free soonest.</div>
        </div>
      </div>

      {data.clinicClosed ? (
        <EmptyState title="Clinic closed today">{data.clinicClosed}. No doctor is scheduled.</EmptyState>
      ) : (
        <>
          {data.working.length === 0 ? (
            <EmptyState title="No doctor is working today">Nobody has a session today.</EmptyState>
          ) : (
            <section className="doc-grid" aria-label="Doctors working today">
              {data.working.map((entry) => (
                <DoctorTodayCard key={entry.doctor.id} entry={entry} />
              ))}
            </section>
          )}

          {data.onLeave.length > 0 ? (
            <section className="card doc-aside" aria-labelledby="on-leave-title">
              <h2 id="on-leave-title">On leave</h2>
              <ul>
                {data.onLeave.map((doctor) => (
                  <li key={doctor.id}>
                    <b>{doctor.name}</b> <span className="muted">{doctor.departmentName} · On leave</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.notIn.length > 0 ? (
            <details className="card doc-aside" data-testid="not-in-today">
              <summary>
                Not in today <span className="muted">({data.notIn.length})</span>
              </summary>
              <ul>
                {data.notIn.map((doctor) => (
                  <li key={doctor.id}>
                    <b>{doctor.name}</b> <span className="muted">{doctor.departmentName}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </>
  );
}
