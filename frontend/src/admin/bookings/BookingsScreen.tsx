"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AdminApiError, adminRequest } from "@/admin/lib/client";
import { EMPTY_FILTERS, filtersToBody, filtersToSearch, type BookingFilters } from "@/admin/lib/bookingsUrl";
import {
  BookingDetailSchema,
  BookingPageSchema,
  OverviewSchema,
  StatusChangeResultSchema,
  type BookingDetail,
  type BookingPage,
  type BookingStatus,
  type BookingSummary,
  type HistoryItem,
  type Lookups,
  type RecentBooking,
} from "@/admin/lib/schemas";
import { allowedNext } from "@/admin/lib/statusRules";
import { clinicClock } from "@/admin/state/clinicClock";
import { NewBookingToasts } from "@/admin/overview/NewBookingToast";
import { demoOverlay } from "@/admin/state/demoOverlay";
import { newBookings } from "@/admin/state/newBookings";
import { undoStore } from "@/admin/state/undo";
import { useLivePoll } from "@/admin/state/liveStatus";
import { EmptyState, ErrorState } from "@/admin/ui/States";

import { BookingCards } from "./BookingCard";
import { BookingDrawer } from "./BookingDrawer";
import { BookingTable } from "./BookingTable";
import { ConfirmDialog, type ChangeRequest } from "./ConfirmDialog";
import { FilterBar, dateLabel, type FilterChange } from "./FilterBar";
import { Pagination } from "./Pagination";
import { StickyFilters } from "./StickyFilters";
import { UndoToast } from "./UndoToast";
import { bookingMessage, latestFrom, messageFor, summaryOf } from "./copy";

const SEARCH_DEBOUNCE_MS = 300;
const DEMO_ACTOR = "You (demo)";

type Counts = Partial<Record<BookingStatus, number>>;

/**
 * The Bookings screen (US4): search and filters, the list (table on desktop, cards on phones), the detail
 * drawer, and the status flow (confirm, change, ten-second undo). The first page arrives rendered by the
 * server. A staff session changes bookings on the server; the demo keeps its changes in the browser
 * (`demoOverlay`), on top of the sample data, and the server stays read-only (ADR-0009).
 */
export function BookingsScreen({ initialPage, lookups, initialFilters, demo, clinicToday, timeZone, serverNow }: { initialPage: BookingPage; lookups: Lookups | null; initialFilters: BookingFilters; demo: boolean; clinicToday: string; timeZone: string; serverNow: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<BookingSummary | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [detailTick, setDetailTick] = useState(0);
  const [request, setRequest] = useState<ChangeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.parse(serverNow));
  const overlayVersion = useSyncExternalStore(demoOverlay.subscribe, demoOverlay.getSnapshot, () => 0);

  // The clinic minute moves "from 09:40" style rules along without re-rendering every second.
  useEffect(() => clinicClock.onMinute((ms) => setNowMs(ms)), []);

  /** What a row looks like now: the demo lays the visitor's own changes over the sample data. */
  const view = useCallback(
    (booking: BookingSummary): BookingSummary => {
      if (!demo) return booking;
      const status = demoOverlay.statusOf(booking.reference, booking.status);
      if (status === booking.status) return booking; // untouched rows keep what the server worked out
      return { ...booking, status, allowedNext: allowedNext(status, Date.parse(booking.startsAt), nowMs) };
    },
    // `overlayVersion` is the signal that the overlay changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, nowMs, overlayVersion],
  );

  const items = useMemo(() => {
    const viewed = data.items.map(view);
    return demo && filters.statuses.length ? viewed.filter((b) => filters.statuses.includes(b.status)) : viewed;
  }, [data.items, view, demo, filters.statuses]);

  const counts = useMemo<Counts>(() => {
    const base: Counts = { ...data.statusCounts };
    if (!demo) return base;
    for (const booking of data.items) {
      const now = demoOverlay.statusOf(booking.reference, booking.status);
      if (now === booking.status) continue;
      base[booking.status] = Math.max(0, (base[booking.status] ?? 0) - 1);
      base[now] = (base[now] ?? 0) + 1;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, demo, overlayVersion]);

  // ----- Filters, address and search --------------------------------------------------------

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });

  const onFilters: FilterChange = useCallback((patch) => setFilters((current) => ({ ...current, ...patch })), []);

  const firstRun = useRef(true);
  const lastQuery = useRef(initialFilters.q);
  useEffect(() => {
    const search = filtersToSearch(filters);
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const typing = filters.q !== lastQuery.current;
    lastQuery.current = filters.q;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const page = await adminRequest({ method: "POST", path: "bookings/search", body: filtersToBody(filters), signal: controller.signal }, BookingPageSchema);
          setData(page);
          setFailed(false);
        } catch (error) {
          if (!controller.signal.aborted && !(error instanceof DOMException)) setFailed(true);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      typing ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters]);

  // ----- Live refresh (FR-041): the list only; the open drawer and the focus are not touched ------

  // The same tick also asks the Overview for the newest bookings, so a "New booking" notification
  // appears here too (US3, FR-042). If that call fails the list still refreshes.
  const load = useCallback(async (signal: AbortSignal) => {
    const asked = filtersRef.current;
    const [page, overview] = await Promise.all([
      adminRequest({ method: "POST", path: "bookings/search", body: filtersToBody(asked), signal }, BookingPageSchema),
      adminRequest({ path: "overview", signal }, OverviewSchema).catch(() => null),
    ]);
    return { asked, page, recent: overview?.recentBookings ?? null };
  }, []);
  const onData = useCallback(({ asked, page, recent }: { asked: BookingFilters; page: BookingPage; recent: RecentBooking[] | null }) => {
    if (recent) newBookings.ingest(recent);
    if (JSON.stringify(asked) !== JSON.stringify(filtersRef.current)) return; // the filters moved on meanwhile
    setData(page);
    setFailed(false);
    setSelected((current) => {
      const fresh = current ? page.items.find((b) => b.reference === current.reference) : undefined;
      if (current && fresh && fresh.version !== current.version) setDetailTick((n) => n + 1);
      return fresh && current && fresh.version !== current.version ? fresh : current;
    });
  }, []);
  const { refresh } = useLivePoll({ load, onData, onError: useCallback(() => setFailed(true), []) });

  // A visitor who opens Bookings first has no baseline yet: learn it now, so that a booking made in the
  // first 30 seconds is announced instead of being taken for something that was already there.
  useEffect(() => {
    if (newBookings.isSeeded()) return;
    const controller = new AbortController();
    adminRequest({ path: "overview", signal: controller.signal }, OverviewSchema)
      .then((overview) => newBookings.ingest(overview.recentBookings ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // ----- The drawer's details ------------------------------------------------------------------

  const openReference = selected?.reference ?? null;
  useEffect(() => {
    if (!openReference) return;
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
  }, [openReference, detailTick]);

  function open(booking: BookingSummary) {
    setDetail(null);
    setDetailFailed(false);
    setMessage(null);
    setSelected(booking);
  }

  function close() {
    setSelected(null);
    setDetail(null);
    setMessage(null);
  }

  /** The drawer's booking with the demo overlay applied, so its buttons follow the visitor's own changes. */
  const shown = selected ? view(items.find((b) => b.reference === selected.reference) ?? selected) : null;
  const history: HistoryItem[] = useMemo(() => {
    if (!detail) return [];
    if (!demo) return detail.history;
    const own = demoOverlay.history(detail.reference).map((change): HistoryItem => ({ at: new Date(change.at).toISOString(), fromStatus: change.from, toStatus: change.to, actor: DEMO_ACTOR, isUndo: change.isUndo }));
    return [...detail.history, ...own];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, demo, overlayVersion]);

  // ----- Status changes ------------------------------------------------------------------------

  /** Writes a booking the server returned into the list, the drawer and the chip counts. */
  function apply(next: BookingDetail, before?: BookingStatus) {
    const row = summaryOf(next);
    setData((page) => {
      const counts = { ...page.statusCounts };
      if (before && before !== next.status) {
        counts[before] = Math.max(0, (counts[before] ?? 0) - 1);
        counts[next.status] = (counts[next.status] ?? 0) + 1;
      }
      return { ...page, items: page.items.map((b) => (b.reference === row.reference ? row : b)), statusCounts: counts };
    });
    setSelected((current) => (current?.reference === row.reference ? row : current));
    setDetail((current) => (current?.reference === row.reference ? next : current));
  }

  async function undoOnServer(reference: string, changeId: string, before: BookingStatus) {
    try {
      apply(await adminRequest({ method: "POST", path: `bookings/${reference}/status/undo`, body: { changeId } }, BookingDetailSchema), before);
      setMessage(null);
    } catch (error) {
      setMessage(bookingMessage(error));
      const latest = latestFrom(error);
      if (latest) apply(latest);
    }
  }

  async function confirm() {
    if (!request) return;
    const { booking, to } = request;
    setBusy(true);
    setMessage(null);
    try {
      if (demo) {
        demoOverlay.setStatus(booking.reference, booking.status, to);
        undoStore.offerUndo({ reference: booking.reference, message: messageFor(request), run: () => void demoOverlay.undo(booking.reference) });
      } else {
        const result = await adminRequest({ method: "POST", path: `bookings/${booking.reference}/status`, body: { to, expectedVersion: booking.version } }, StatusChangeResultSchema);
        apply(result.booking, booking.status);
        undoStore.offerUndo({ reference: booking.reference, message: messageFor(request), run: () => undoOnServer(booking.reference, result.changeId, to) });
      }
    } catch (error) {
      setMessage(bookingMessage(error));
      const latest = latestFrom(error);
      if (latest) apply(latest);
      else if (error instanceof AdminApiError && error.status === 409) refresh();
    } finally {
      setBusy(false);
      setRequest(null);
    }
  }

  const choose = (booking: BookingSummary, to: BookingStatus) => {
    if (to !== "confirmed") setRequest({ booking, to });
  };

  // ----- Rendering ----------------------------------------------------------------------------

  const total = demo && filters.statuses.length ? items.length : data.total;
  const label = dateLabel(filters, clinicToday);
  const heading = label.startsWith("Today") ? "Today" : label;
  const isFiltered = Boolean(filters.q.trim() || filters.doctor || filters.department || filters.statuses.length || filters.from || filters.to);
  const allCounts = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);
  const clear = () => setFilters({ ...EMPTY_FILTERS });
  const pageTo = (page: number) => setFilters((current) => ({ ...current, page }));

  const list = (
    <>
      {items.length === 0 ? (
        <EmptyState
          title="No bookings match these filters"
          action={
            isFiltered ? (
              <button type="button" className="btn btn-sm" onClick={clear}>
                Clear filters
              </button>
            ) : undefined
          }
        >
          {isFiltered ? "Try a different search, date or status." : "There are no bookings for this day."}
        </EmptyState>
      ) : null}
    </>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bookings</h1>
          <div className="sub" data-testid="bookings-summary">
            {heading} · {total} {total === 1 ? "booking" : "bookings"} · clinic time (Karachi)
          </div>
        </div>
      </div>

      {failed ? (
        <ErrorState title="We could not refresh the list" onRetry={refresh}>
          The last list is still shown. Please try again in a moment.
        </ErrorState>
      ) : null}
      {message && !selected ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}

      <section className="card d-only" aria-label="Bookings" aria-busy={loading} data-loading={loading ? "true" : "false"}>
        <FilterBar filters={filters} lookups={lookups} today={clinicToday} counts={counts} total={allCounts} onChange={onFilters} />
        {items.length > 0 ? <BookingTable bookings={items} onOpen={(booking) => open(booking)} onQuick={choose} busyReference={busy ? (request?.booking.reference ?? null) : null} /> : list}
        <Pagination page={data.page} total={total} pageSize={data.pageSize} onPage={pageTo} />
      </section>

      <div className="m-only" aria-busy={loading}>
        <StickyFilters filters={filters} lookups={lookups} today={clinicToday} counts={counts} total={allCounts} onChange={onFilters} />
        <p className="count-line">
          {total} {total === 1 ? "booking" : "bookings"} · {heading.toLowerCase() === "today" ? "today" : heading}
        </p>
        {items.length > 0 ? <BookingCards bookings={items} onOpen={(booking) => open(booking)} timeZone={timeZone} /> : list}
        <Pagination page={data.page} total={total} pageSize={data.pageSize} onPage={pageTo} />
      </div>

      <BookingDrawer
        summary={shown}
        detail={detail}
        history={history}
        failed={detailFailed}
        message={message}
        demo={demo}
        busy={busy}
        nowMs={nowMs}
        timeZone={timeZone}
        onChoose={(to) => shown && choose(shown, to)}
        onClose={close}
      />
      <ConfirmDialog request={request} busy={busy} onConfirm={() => void confirm()} onCancel={() => setRequest(null)} />
      <UndoToast />
      <NewBookingToasts today={clinicToday} onView={(booking) => open(booking)} />
    </>
  );
}
