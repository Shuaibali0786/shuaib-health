// The bookings part of the mock Command Centre API (Feature 006, US4): lookups, search, detail, status
// change, undo and phone reveal. In memory only. Node built-ins only. Never used in production.
// A demo session reads the fixture as it is (the demo server is read-only); a staff session works on a copy
// of the same day with "R" references, so a test may change it without touching the demo's data.
// The rules are a copy of backend/app/command_centre/status.py; tests/unit/mock-api-admin-bookings.test.ts
// checks them against src/admin/lib/statusRules.ts.
import { randomUUID } from "node:crypto";

const PAGE_SIZE = 20;
const UNDO_WINDOW_MS = 10_000;
const TRANSITIONS = { confirmed: ["arrived", "no_show", "cancelled"], arrived: ["completed", "no_show"], completed: [], no_show: [], cancelled: [] };
const DISPLAY_ORDER = ["arrived", "completed", "no_show", "cancelled"];
const ARRIVE_LEAD_MS = 2 * 60 * 60 * 1000;

export function allowedNext(status, startsAtMs, nowMs) {
  const timeOk = {
    arrived: nowMs >= startsAtMs - ARRIVE_LEAD_MS,
    no_show: nowMs >= startsAtMs,
    cancelled: nowMs < startsAtMs,
    completed: true,
  };
  return DISPLAY_ORDER.filter((to) => TRANSITIONS[status].includes(to) && timeOk[to]);
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomCode = (length) => Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const errorBody = (code, message, extra = {}) => ({ error: { code, message, requestId: "mock" }, ...extra });
const refuse = (status, code, message, extra) => ({ status, body: errorBody(code, message, extra) });
const SUMMARY_KEYS = ["reference", "startsAt", "endsAt", "localDate", "localTime", "status", "version", "patientNameMasked", "phoneMasked", "doctor", "allowedNext", "isSample"];
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]]));

/** `0315****277` -> `0315 0000277`: a full number that is consistent with its masked form. */
function fullPhone(masked) {
  return `${masked.slice(0, 4)} 0000${masked.slice(-3)}`;
}

export function createBookings({ fixture, now }) {
  const nowMs = () => Date.parse(now);
  const stamp = () => new Date(nowMs()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const departmentIds = new Map(fixture.lookups.departments.map((department) => [department.name, department.id]));

  const seed = (prefix) =>
    fixture.details.map((detail) => ({ ...structuredClone(detail), reference: prefix ? prefix + detail.reference.slice(1) : detail.reference, version: 1 }));

  let staffBookings = seed("R");
  const demoBookings = seed(null);
  let changes = [];
  let serial = 0;

  const reset = () => {
    staffBookings = seed("R");
    changes = [];
    serial = 0;
  };

  const withNext = (booking) => ({ ...booking, allowedNext: allowedNext(booking.status, Date.parse(booking.startsAt), nowMs()) });
  const summaryOf = (booking) => pick(withNext(booking), SUMMARY_KEYS);
  const find = (list, reference) => list.find((booking) => booking.reference === reference);

  /** A fresh future booking for one test to own (tests run in parallel against one mock). */
  function createFresh({ minutesFromNow = 20, name = "Test Patient" } = {}) {
    serial += 1;
    const template = fixture.details.find((detail) => detail.status === "confirmed") ?? fixture.details[0];
    const starts = new Date(nowMs() + minutesFromNow * 60_000);
    const ends = new Date(starts.getTime() + 20 * 60_000);
    const clinic = new Intl.DateTimeFormat("en-GB", { timeZone: fixture.meta.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(starts);
    const reference = `T${String(serial).padStart(3, "0")}${randomCode(6)}`;
    const booking = {
      ...structuredClone(template),
      reference,
      version: 1,
      status: "confirmed",
      startsAt: starts.toISOString().replace(/\.\d{3}Z$/, "Z"),
      endsAt: ends.toISOString().replace(/\.\d{3}Z$/, "Z"),
      localTime: clinic,
      // Newer than every seeded booking and than the one before it, so the Overview's recentBookings sees it as new.
      bookedAt: new Date(nowMs() + serial * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
      patientName: name,
      patientNameMasked: `${name.split(" ")[0]} ${name.split(" ").at(-1)?.[0] ?? ""}.`,
      history: [{ at: stamp(), toStatus: "confirmed", actor: "Online booking", isUndo: false }],
    };
    staffBookings.push(booking);
    return reference;
  }

  function searchResult(list, body) {
    const q = typeof body.q === "string" ? body.q.trim().toLowerCase() : "";
    const from = body.from ?? body.to ?? fixture.meta.date;
    const to = body.to ?? from;
    const wanted = Array.isArray(body.statuses) ? body.statuses : [];
    const inWindow = list
      .filter((b) => b.localDate >= from && b.localDate <= to)
      .filter((b) => !q || b.reference.toLowerCase().includes(q) || b.patientName.toLowerCase().includes(q))
      .filter((b) => !body.doctorId || b.doctor.id === body.doctorId)
      .filter((b) => !body.departmentId || departmentIds.get(b.doctor.departmentName) === body.departmentId);
    const statusCounts = {};
    for (const b of inWindow) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
    const hits = inWindow
      .filter((b) => wanted.length === 0 || wanted.includes(b.status))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.doctor.name.localeCompare(b.doctor.name) || a.reference.localeCompare(b.reference));
    const page = Number.isInteger(body.page) && body.page >= 1 ? body.page : 1;
    return { items: hits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(summaryOf), total: hits.length, statusCounts, page, pageSize: PAGE_SIZE };
  }

  /**
   * `route` is the path after `/api/v1/admin`; `session` is the caller (already authenticated and, for a
   * write, CSRF-checked by the caller). Returns a result, or null when the route is not a bookings route.
   */
  function handle({ method, route, bodyText, session, mode }) {
    const demo = session.kind === "demo";
    const list = demo ? demoBookings : staffBookings;

    if (method === "GET" && route === "/lookups") return { status: 200, body: fixture.lookups };

    if (method === "POST" && route === "/bookings/search") {
      let body;
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        return refuse(422, "validation_error", "Some request parameters are invalid.");
      }
      if (typeof body.q === "string" && body.q.length > 80) return refuse(422, "validation_error", "Some request parameters are invalid.");
      return { status: 200, body: searchResult(list, body) };
    }

    const match = route.match(/^\/bookings\/([0-9A-Za-z]{10})(\/status\/undo|\/status|\/reveal-phone)?$/);
    if (!match) return null;
    const [, reference, action] = match;
    const booking = find(list, reference.toUpperCase());
    if (!booking) return refuse(404, "not_found", "Not found.");
    const detail = () => withNext(booking);

    if (method === "GET" && !action) return { status: 200, body: detail() };
    if (method === "POST" && action === "/reveal-phone") return { status: 200, body: { phone: fullPhone(booking.phoneMasked), telHref: `tel:+92${fullPhone(booking.phoneMasked).replace(/\D/g, "").slice(1)}`, maskAfterSeconds: 60 } };

    if (method === "POST" && action === "/status") {
      let body;
      try {
        body = JSON.parse(bodyText || "{}");
      } catch {
        return refuse(422, "validation_error", "Some request parameters are invalid.");
      }
      if (!["arrived", "completed", "no_show", "cancelled"].includes(body.to) || !Number.isInteger(body.expectedVersion)) {
        return refuse(422, "validation_error", "Some request parameters are invalid.");
      }
      if (mode === "booking-changed" && booking.version === body.expectedVersion) {
        // Somebody else moved this booking first.
        booking.status = "arrived";
        booking.version += 1;
        booking.history.push({ at: stamp(), fromStatus: "confirmed", toStatus: "arrived", actor: "Another receptionist", isUndo: false });
      }
      if (body.expectedVersion !== booking.version) return refuse(409, "booking_changed", "This booking was changed by someone else.", { latest: detail() });
      if (!allowedNext(booking.status, Date.parse(booking.startsAt), nowMs()).includes(body.to)) return refuse(409, "transition_not_allowed", "That status change is not allowed.");
      const from = booking.status;
      booking.status = body.to;
      booking.version += 1;
      booking.history.push({ at: stamp(), fromStatus: from, toStatus: body.to, actor: session.displayName, isUndo: false });
      const change = { id: randomUUID(), reference: booking.reference, from, to: body.to, versionAfter: booking.version, actor: session.email, isUndo: false, expiresAt: nowMs() + UNDO_WINDOW_MS };
      changes.push(change);
      return { status: 200, body: { booking: detail(), changeId: change.id, undoExpiresAt: new Date(change.expiresAt).toISOString().replace(/\.\d{3}Z$/, "Z") } };
    }

    if (method === "POST" && action === "/status/undo") {
      let body;
      try {
        body = JSON.parse(bodyText || "{}");
      } catch {
        return refuse(422, "validation_error", "Some request parameters are invalid.");
      }
      const mine = changes.filter((c) => c.reference === booking.reference);
      const latest = mine.at(-1);
      const original = mine.find((c) => c.id === body.changeId);
      const ok = original && latest === original && !original.isUndo && original.actor === session.email && booking.version === original.versionAfter;
      if (!ok) return refuse(409, "undo_unavailable", "This change can no longer be undone.", { latest: detail() });
      booking.status = original.from;
      booking.version += 1;
      booking.history.push({ at: stamp(), fromStatus: original.to, toStatus: original.from, actor: session.displayName, isUndo: true });
      changes.push({ id: randomUUID(), reference: booking.reference, from: original.to, to: original.from, versionAfter: booking.version, actor: session.email, isUndo: true, expiresAt: 0 });
      return { status: 200, body: detail() };
    }

    return refuse(404, "not_found", "Not found.");
  }

  /**
   * `GET /admin/overview`: the same definitions as the backend (data-model §8) over the day's bookings. The
   * doctors, their sessions and last week's numbers come from the fixture; today's numbers follow the bookings,
   * so a status change or a new booking shows up. A session marked `overview: "closed"` or `"empty"` gets a
   * holiday or a day with no bookings.
   */
  function overview(session) {
    const demo = session.kind === "demo";
    const base = fixture.overview;
    const state = session.overview;
    const todays = state ? [] : (demo ? demoBookings : staffBookings).filter((b) => b.localDate === fixture.meta.date);
    const counts = { confirmed: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
    for (const b of todays) counts[b.status] += 1;
    const appointments = todays.length - counts.cancelled;
    const slots = base.agenda.reduce((sum, row) => sum + row.sessions.reduce((n, s) => n + Math.floor((minutesOf(s.end) - minutesOf(s.start)) / fixture.meta.slotMinutes), 0), 0);
    const trend = (key, value) => {
      const previous = base.kpis[key].previous;
      return { value, previous, delta: value === null || previous === null ? null : value - previous, comparedTo: base.kpis[key].comparedTo };
    };
    const closed = state === "closed";
    const kpis = {
      appointments: trend("appointments", appointments),
      arrived: trend("arrived", counts.arrived + counts.completed),
      completed: trend("completed", counts.completed),
      noShows: trend("noShows", counts.no_show),
      cancellations: trend("cancellations", counts.cancelled),
      utilisationPct: trend("utilisationPct", closed ? null : Math.floor((200 * appointments + slots) / (2 * slots))),
    };
    const rows = new Map(base.agenda.map((row) => [row.doctor.id, { doctor: row.doctor, sessions: row.sessions, items: [] }]));
    for (const b of todays) rows.get(b.doctor.id)?.items.push(summaryOf(b));
    const agenda = todays.length === 0 ? [] : [...rows.values()].map((row) => ({ ...row, items: row.items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.reference.localeCompare(b.reference)) }));
    const nextUp = todays
      .filter((b) => b.status === "confirmed" && Date.parse(b.startsAt) >= nowMs() - 15 * 60_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.doctor.name.localeCompare(b.doctor.name) || a.reference.localeCompare(b.reference))
      .slice(0, 5)
      .map(summaryOf);
    const recentBookings = demo
      ? []
      : staffBookings
          .filter((b) => b.bookedAt)
          .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt) || a.reference.localeCompare(b.reference))
          .slice(0, 5)
          .map((b) => ({ ...summaryOf(b), bookedAt: b.bookedAt }));
    return {
      localDate: fixture.meta.date,
      now: now,
      clinicClosed: closed ? "Founders Day" : null,
      kpis,
      agenda,
      nextUp,
      recentBookings,
      isSample: demo,
    };
  }

  /** `GET /admin/insights?range=`: the demo day's charts for 7, 30 or 90 days (a session marked `overview: "empty"` has no bookings); null for any other range. */
  function insights(range, session) {
    if (!["7", "30", "90"].includes(range ?? "")) return null;
    const base = fixture.insights[range];
    if (session.overview !== "empty") return { status: 200, body: { ...base, isSample: session.kind === "demo" } };
    // A day with no bookings at all: every figure zero.
    return { status: 200, body: { ...base, total: 0, perDay: base.perDay.map((d) => ({ ...d, count: 0 })), byDepartment: [], byStatus: base.byStatus.map((s) => ({ ...s, count: 0 })), byHour: base.byHour.map((h) => ({ ...h, count: 0 })) } };
  }

  /** `GET /admin/doctors-today`: the day's schedules from the fixture. A session marked `overview: "closed"` gets the holiday. */
  function doctorsToday(session) {
    const base = structuredClone(fixture.doctorsToday);
    if (session.overview === "closed") return { ...base, clinicClosed: "Founders Day", working: [], onLeave: [], notIn: [] };
    return { ...base, isSample: session.kind === "demo" };
  }

  /** `GET /admin/activity`: the synthetic feed, newest first, filtered by `action` and `staffId` and paged by 25. */
  function activity(query) {
    const size = 25;
    const page = Math.max(1, Number(query.get("page")) || 1);
    const action = query.get("action");
    const staffName = query.get("staffId") ? (fixture.staff.find((member) => member.id === query.get("staffId"))?.displayName ?? "") : null;
    const hits = fixture.activity.filter((event) => (!action || event.action === action) && (staffName === null || event.actorName === staffName));
    return { status: 200, body: { items: hits.slice((page - 1) * size, page * size), total: hits.length, page, pageSize: size } };
  }

  return { handle, reset, createFresh, overview, insights, doctorsToday, activity };
}
