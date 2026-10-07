import type { DoctorToday } from "@/admin/lib/schemas";

const slotWord = (n: number) => `${n} ${n === 1 ? "slot" : "slots"}`;

/** One doctor who is in today: sessions, a booked-against-scheduled bar, free slots and the next free time. */
export function DoctorTodayCard({ entry }: { entry: DoctorToday }) {
  const hours = entry.sessions.filter((s) => s.start && s.end).map((s) => `${s.start}–${s.end}`).join(", ");
  const passed = entry.freePassed ?? 0;
  const upcoming = Math.max(0, entry.free - passed);
  const full = entry.free === 0;
  return (
    <article className="card doc-card" data-doctor={entry.doctor.name} aria-label={`${entry.doctor.name}, ${entry.doctor.departmentName}`}>
      <header>
        <h3>{entry.doctor.name}</h3>
        <p className="dept">{entry.doctor.departmentName}</p>
      </header>
      <p className="hours">In {hours}</p>
      <div className="util" role="img" aria-label={`${entry.booked} of ${slotWord(entry.scheduled)} booked, ${entry.utilisationPct} percent`}>
        <span className="bar-track">
          <span className="bar-fill" style={{ width: `${Math.min(100, entry.utilisationPct)}%` }} />
        </span>
        <span className="pct num">{entry.utilisationPct}%</span>
      </div>
      <dl className="doc-stats">
        <div>
          <dt>Booked</dt>
          <dd className="num">{entry.booked}</dd>
        </div>
        <div>
          <dt>Free</dt>
          <dd className="num">{entry.free}</dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd className="num">{entry.scheduled}</dd>
        </div>
      </dl>
      <p className={`next-free${full ? " full" : ""}`}>
        {entry.nextFree ? (
          <>
            Next free <b className="num">{entry.nextFree}</b>
            {upcoming > 0 ? <span className="muted"> · {slotWord(upcoming)} still ahead</span> : null}
          </>
        ) : full ? (
          "Fully booked"
        ) : (
          "No free slot left today"
        )}
        {passed > 0 ? <span className="passed"> · {passed} free {passed === 1 ? "slot" : "slots"} passed</span> : null}
      </p>
    </article>
  );
}
