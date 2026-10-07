"use client";

import { ChevronRight, Search, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { BookingDrawer } from "@/admin/bookings/BookingDrawer";
import { ConfirmDialog } from "@/admin/bookings/ConfirmDialog";
import { StatusBadge } from "@/admin/bookings/StatusBadge";
import { UndoToast } from "@/admin/bookings/UndoToast";
import { summaryOf } from "@/admin/bookings/copy";
import { adminRequest } from "@/admin/lib/client";
import { formatLongDate, greeting } from "@/admin/lib/format";
import { BookingDetailSchema, OverviewSchema, type BookingDetail, type BookingSummary, type HistoryItem, type Overview, type RecentBooking } from "@/admin/lib/schemas";
import { clinicClock, deviceReference } from "@/admin/state/clinicClock";
import { demoOverlay } from "@/admin/state/demoOverlay";
import { startSimulation, simulateBooking } from "@/admin/state/demoSimulation";
import { useLivePoll } from "@/admin/state/liveStatus";
import { newBookings } from "@/admin/state/newBookings";
import { EmptyState, ErrorState } from "@/admin/ui/States";

import { AgendaList } from "./AgendaList";
import { AgendaTimeline, type OpenBooking } from "./AgendaTimeline";
import { AgendaViewToggle, type AgendaView } from "./AgendaViewToggle";
import { KpiGrid } from "./KpiGrid";
import { NewBookingToasts } from "./NewBookingToast";
import { NextUpList } from "./NextUpList";
import { StatusMix } from "./StatusMix";
import { countStatuses, deriveOverview } from "./model";
import { useStatusFlow } from "./useStatusFlow";

const DEMO_ACTOR = "You (demo)";
const GLOW_MS = 10_000;
const LEGEND = ["confirmed", "arrived", "completed", "no_show", "cancelled"] as const;

/**
 * The Overview (US3): today at a glance, live. The first answer is rendered by the server; from then on this
 * island polls `/api/admin/overview` every 30 s while the tab is visible, moves the "Now" line each clinic
 * minute and keeps the numbers, the agenda and the lists in step. Updating never moves focus and never
 * closes an open drawer. A staff session changes bookings on the server; the demo keeps its own changes and
 * the bookings it simulates in the browser (`demoOverlay`), and the server stays read-only (ADR-0009).
 */
export function OverviewScreen({ initial, demo, firstName, timeZone, serverNow }: { initial: Overview; demo: boolean; firstName?: string; timeZone: string; serverNow: string }) {
  const [data, setData] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.parse(serverNow));
  const [glowing, setGlowing] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<BookingSummary | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [agendaView, setAgendaView] = useState<AgendaView>("timeline");
  const overlayVersion = useSyncExternalStore(demoOverlay.subscribe, demoOverlay.getSnapshot, () => 0);

  // The clinic clock follows the API’s own instant: `serverNow` is the `now` of the Overview answer, so the
  // header clock, the greeting and the "Now" line agree with the status of every booking, whatever the device says.
  useEffect(() => {
    clinicClock.seed(Date.parse(serverNow), deviceReference());
  }, [serverNow]);

  // The clinic minute moves the "Now" line, the greeting and what the clock allows (arrive from two hours before).
  useEffect(() => clinicClock.onMinute((ms) => setNowMs(ms)), []);

  const view = useMemo(
    () => deriveOverview(data, demo ? { nowMs, statusOf: demoOverlay.statusOf.bind(demoOverlay), extras: demoOverlay.bookings() } : { nowMs }),
    // `overlayVersion` is the signal that the demo overlay changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, nowMs, demo, overlayVersion],
  );
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });

  // ----- New bookings: notifications and the 10 s glow ------------------------------------------

  const glow = useCallback((references: readonly string[]) => {
    if (references.length === 0) return;
    setGlowing((current) => new Set([...current, ...references]));
    setTimeout(() => {
      setGlowing((current) => {
        const next = new Set(current);
        for (const reference of references) next.delete(reference);
        return next;
      });
    }, GLOW_MS);
  }, []);

  const feed = useCallback(
    (recent: readonly RecentBooking[] | undefined) => {
      glow(newBookings.ingest(recent ?? []).map((booking) => booking.reference));
    },
    [glow],
  );

  // What is on the screen at first paint is the baseline: it is not "new".
  useEffect(() => {
    newBookings.ingest(initial.recentBookings ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Live refresh (FR-041) -------------------------------------------------------------------

  const load = useCallback((signal: AbortSignal) => adminRequest({ path: "overview", signal }, OverviewSchema), []);
  const onData = useCallback(
    (next: Overview) => {
      setData(next);
      setFailed(false);
      feed(next.recentBookings);
    },
    [feed],
  );
  const { refresh } = useLivePoll({ load, onData, onError: useCallback(() => setFailed(true), []) });
  useEffect(() => clinicClock.onNewDay(() => refresh()), [refresh]);

  // ----- Demo: simulated online bookings (50 s, then every 75 s; never sent to the server) --------

  useEffect(() => {
    if (!demo) return;
    return startSimulation(() => {
      if (document.visibilityState === "hidden") return;
      const next = simulateBooking({ date: viewRef.current.localDate, timeZone, agenda: viewRef.current.agenda, nowMs: clinicClock.now(), serial: demoOverlay.bookings().length + 1 });
      if (!next) return;
      demoOverlay.addBooking(next.detail);
      newBookings.announce({ ...next.summary, bookedAt: next.detail.bookedAt });
      glow([next.summary.reference]);
    });
  }, [demo, timeZone, glow]);

  // ----- The drawer ------------------------------------------------------------------------------

  const openReference = selected?.reference ?? null;
  useEffect(() => {
    if (!openReference) return;
    if (demoOverlay.detailOf(openReference)) return; // a simulated booking: its detail is already here
    const controller = new AbortController();
    adminRequest({ path: `bookings/${openReference}`, signal: controller.signal }, BookingDetailSchema)
      .then((next) => {
        setDetail(next);
        setDetailFailed(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !(error instanceof DOMException)) setDetailFailed(true);
      });
    return () => controller.abort();
  }, [openReference]);

  const open = useCallback((booking: BookingSummary) => {
    setDetail(null);
    setDetailFailed(false);
    setSelected(booking);
  }, []);
  const openFromChip: OpenBooking = useCallback((booking) => open(booking), [open]);
  const close = () => {
    setSelected(null);
    setDetail(null);
  };

  const items = useMemo(() => view.agenda.flatMap((row) => row.items), [view]);
  const shown = selected ? (items.find((b) => b.reference === selected.reference) ?? selected) : null;
  // A booking the demo simulated has no server record; its detail is kept in the overlay.
  const fullDetail = (openReference ? demoOverlay.detailOf(openReference) : undefined) ?? detail;
  const history: HistoryItem[] = useMemo(() => {
    if (!fullDetail) return [];
    if (!demo) return fullDetail.history;
    const own = demoOverlay.history(fullDetail.reference).map((change): HistoryItem => ({ at: new Date(change.at).toISOString(), fromStatus: change.from, toStatus: change.to, actor: DEMO_ACTOR, isUndo: change.isUndo }));
    return [...fullDetail.history, ...own];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullDetail, demo, overlayVersion]);

  // ----- Status changes (the drawer and "Mark arrived") --------------------------------------------

  /** A booking the server returned: show it now, then fetch the whole Overview so every number follows. */
  const apply = useCallback(
    (next: BookingDetail) => {
      const row = summaryOf(next);
      setData((current) => ({ ...current, agenda: current.agenda.map((entry) => ({ ...entry, items: entry.items.map((b) => (b.reference === row.reference ? row : b)) })) }));
      setSelected((current) => (current?.reference === row.reference ? row : current));
      setDetail((current) => (current?.reference === row.reference ? next : current));
      refresh();
    },
    [refresh],
  );
  const flow = useStatusFlow({ demo, onApplied: apply, onStale: refresh });

  // ----- Rendering -------------------------------------------------------------------------------

  const counts = countStatuses(items);
  const doctors = view.agenda.length;
  const meta = `${doctors} ${doctors === 1 ? "doctor" : "doctors"} working · ${items.length} ${items.length === 1 ? "booking" : "bookings"} incl. ${counts.cancelled} cancelled`;
  const empty = view.agenda.length === 0;
  const closed = data.clinicClosed ?? null;
  const emptyState = closed ? (
    <EmptyState title="The clinic is closed today">{closed}. There are no appointments to show.</EmptyState>
  ) : (
    <EmptyState title="No bookings today">Appointments made for today will appear here.</EmptyState>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display" id="greeting">
            {greeting(nowMs, timeZone)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <div className="sub" id="page-sub">
            Today at the clinic · {formatLongDate(view.localDate)}
          </div>
        </div>
        <div className="actions">
          <Link className="btn" href="/admin/bookings" prefetch={false}>
            <Search className="i i-sm" aria-hidden="true" />
            Find a booking
          </Link>
          <Link className="btn btn-primary" href="/admin/bookings" prefetch={false}>
            <CalendarCheck className="i i-sm" aria-hidden="true" />
            Open bookings
          </Link>
        </div>
      </div>

      {failed ? (
        <ErrorState title="We could not refresh the overview" onRetry={refresh}>
          The last numbers are still shown. Please try again in a moment.
        </ErrorState>
      ) : null}
      {flow.message && !selected ? (
        <p role="alert" className="field-error">
          {flow.message}
        </p>
      ) : null}

      <KpiGrid kpis={view.kpis} />

      <section className="card agenda d-only" aria-labelledby="ag-h">
        <div className="card-head">
          <h2 className="display" id="ag-h">
            Today’s agenda
          </h2>
          <span className="meta" id="ag-meta">
            {meta}
          </span>
          {empty ? null : <AgendaViewToggle view={agendaView} onChange={setAgendaView} />}
          <span className="right">
            <Link className="btn btn-quiet btn-sm" href="/admin/doctors" prefetch={false}>
              Doctors today
              <ChevronRight className="i i-sm" aria-hidden="true" />
            </Link>
          </span>
        </div>
        {empty ? (
          emptyState
        ) : (
          <>
            {agendaView === "timeline" ? (
              <>
                <p className="sr-only">Each booking is a button: focus or hover shows its time, patient initials and status; activate it to open the booking.</p>
                <AgendaTimeline agenda={view.agenda} nowMs={nowMs} timeZone={timeZone} highlight={glowing} onOpen={openFromChip} />
                <div className="legend" aria-label="Status key" role="group">
                  {LEGEND.map((status) => (
                    <StatusBadge key={status} status={status} />
                  ))}
                </div>
              </>
            ) : (
              <AgendaList agenda={view.agenda} nowMs={nowMs} timeZone={timeZone} highlight={glowing} onOpen={openFromChip} />
            )}
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="nu-h">
          <div className="card-head">
            <h2 className="display" id="nu-h">
              Next patients up
            </h2>
            <span className="meta">Confirmed, not yet arrived</span>
          </div>
          <NextUpList items={view.nextUp} timeZone={timeZone} busyReference={flow.busy ? (flow.request?.booking.reference ?? null) : null} onArrive={(booking) => flow.choose(booking, "arrived")} />
        </section>
        <section className="card" aria-labelledby="mx-h">
          <div className="card-head">
            <h2 className="display" id="mx-h">
              Today by status
            </h2>
            <span className="meta" id="mx-meta">
              {items.length} {items.length === 1 ? "booking" : "bookings"}
            </span>
          </div>
          <StatusMix counts={counts} />
        </section>
      </div>

      <section className="card m-only agenda-mobile" aria-labelledby="mag-h">
        <div className="card-head">
          <h2 className="display" id="mag-h">
            Today’s agenda
          </h2>
          <span className="meta">
            {doctors} {doctors === 1 ? "doctor" : "doctors"}
          </span>
        </div>
        {empty ? emptyState : <AgendaList agenda={view.agenda} nowMs={nowMs} timeZone={timeZone} highlight={glowing} onOpen={openFromChip} />}
      </section>

      <BookingDrawer
        summary={shown}
        detail={fullDetail}
        history={history}
        failed={detailFailed}
        message={flow.message}
        demo={demo}
        busy={flow.busy}
        nowMs={nowMs}
        timeZone={timeZone}
        onChoose={(to) => shown && flow.choose(shown, to)}
        onClose={close}
      />
      <ConfirmDialog request={flow.request} busy={flow.busy} onConfirm={() => void flow.confirm()} onCancel={flow.cancel} />
      <UndoToast />
      <NewBookingToasts today={view.localDate} onView={open} />
    </>
  );
}
