// Booking half of the mock API (contract: specs/005-appointment-booking/contracts/website-booking.md §5).
// In memory only; `reset()` clears it. The slot rules follow data-model §9 for a clinic in
// Asia/Karachi (a fixed +05:00 offset, no daylight saving), with a 2 h lead time and a 14-day window.
// Node built-ins only. Never used in production.
import { createHash, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("../fixtures/api/", import.meta.url));

export const BOOKING_MODES = ["booking-down", "booking-slow", "slot-taken", "rate-limited"];

const OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Karachi
const LEAD_MS = 2 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const BOOKING_SLOW_MS = 20_000;

const fixture = (name) => JSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8"));

const pad = (n) => String(n).padStart(2, "0");
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Clinic-local date (YYYY-MM-DD) and time (HH:MM) of a UTC instant. */
function localParts(ms) {
  const d = new Date(ms + OFFSET_MS);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function maskName(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => `${[...word][0]}****`)
    .join(" ");
}

function maskMobile(raw) {
  const digits = String(raw).replace(/\D/g, "");
  const national = digits.replace(/^(0092|92|0)/, "");
  const local = `0${national}`;
  return `${local.slice(0, 4)}****${local.slice(-3)}`;
}

const newReference = () => Array.from({ length: 10 }, () => CROCKFORD[randomInt(CROCKFORD.length)]).join("");
const displayReference = (ref) => `${ref.slice(0, 5)}-${ref.slice(5)}`;
const parseReference = (text) => {
  const ref = text.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-HJKMNP-TV-Z]{10}$/.test(ref) ? ref : null;
};

const errorBody = (code, message, extra = {}, details) => ({
  error: { code, message, requestId: "mock", ...(details ? { details } : {}) },
  ...extra,
});

/**
 * @param {{ now?: string, proxySecret?: string }} options
 *   `now`: the fixed clock (ISO instant), default MOCK_NOW or 2026-10-05T04:00:00Z.
 *   `proxySecret`: the required X-Proxy-Secret, default MOCK_PROXY_SECRET; when unset the check is skipped.
 */
export function createBooking({
  now = process.env.MOCK_NOW || "2026-10-05T04:00:00Z",
  proxySecret = process.env.MOCK_PROXY_SECRET,
} = {}) {
  const nowMs = Date.parse(now);
  const doctors = fixture("doctors").items;
  const departments = fixture("departments").items;
  const clinic = fixture("clinic");

  /** slot key -> appointment record. */
  let booked = new Map();
  /** idempotency key -> { hash, view }. */
  let results = new Map();
  /** reference -> view. */
  let byReference = new Map();
  let loseNext = false;

  const slotKey = (slug, startsAt) => `${slug}|${startsAt}`;

  function reset() {
    booked = new Map();
    results = new Map();
    byReference = new Map();
    loseNext = false;
  }

  /** Days for one doctor, using the same rules as the real engine. */
  function buildDays(doctor) {
    const base = Math.floor((nowMs + OFFSET_MS) / 86_400_000) * 86_400_000 - OFFSET_MS; // local midnight, as UTC ms
    const days = [];
    for (let d = 0; d < WINDOW_DAYS; d++) {
      const dayStart = base + d * 86_400_000;
      const { date } = localParts(dayStart);
      const weekday = WEEKDAYS[new Date(dayStart + OFFSET_MS).getUTCDay()];
      const sessions = doctor.schedule.filter((s) => s.day === weekday);
      if (sessions.length === 0) {
        days.push({ date, weekday, status: "not_working", slots: [] });
        continue;
      }
      let taken = 0;
      const slots = [];
      for (const session of sessions) {
        const step = session.slotMinutes ?? 15;
        for (let m = minutesOf(session.start); m + step <= minutesOf(session.end); m += step) {
          const startMs = dayStart + m * 60_000;
          const endMs = startMs + step * 60_000;
          if (startMs < nowMs + LEAD_MS) {
            continue; // too soon or already past
          } else if (booked.has(slotKey(doctor.slug, iso(startMs)))) {
            taken++;
          } else {
            slots.push({ startsAt: iso(startMs), endsAt: iso(endMs), localTime: localParts(startMs).time });
          }
        }
      }
      const status = slots.length > 0 ? "available" : taken > 0 ? "fully_booked" : "no_longer_available";
      days.push({ date, weekday, status, slots });
    }
    return days;
  }

  function slotsBody(doctor) {
    return {
      doctorSlug: doctor.slug,
      timeZone: clinic.timeZone,
      windowDays: WINDOW_DAYS,
      generatedAt: iso(nowMs),
      days: buildDays(doctor),
    };
  }

  function alternatives(doctor, afterMs) {
    const found = [];
    for (const day of buildDays(doctor)) {
      for (const slot of day.slots) {
        if (Date.parse(slot.startsAt) > afterMs && found.length < 5) {
          found.push({ ...slot, localDate: day.date });
        }
      }
    }
    return found.map(({ startsAt, endsAt, localDate, localTime }) => ({ startsAt, endsAt, localDate, localTime }));
  }

  function viewOf(record) {
    const doctor = doctors.find((d) => d.slug === record.doctorSlug);
    const department = departments.find((d) => d.id === doctor.departmentId);
    const { date, time } = localParts(Date.parse(record.startsAt));
    return {
      reference: displayReference(record.reference),
      status: "confirmed",
      doctor: { slug: doctor.slug, fullName: doctor.fullName, specialty: doctor.specialty },
      department: { slug: department.slug, name: department.name },
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      localDate: date,
      localTime: time,
      timeZone: clinic.timeZone,
      feePkr: doctor.feePkr,
      patientNameMasked: maskName(record.fullName),
      mobileMasked: maskMobile(record.mobile),
      isSample: true,
    };
  }

  const secretOk = (req) => !proxySecret || req.headers["x-proxy-secret"] === proxySecret;

  /**
   * Handle one booking request. Returns `{ status, body, headers?, destroy?, delayMs? }`, or null when the
   * path is not a booking route. The caller applies the mode (down / slow) and writes the response.
   */
  function handle({ method, path, headers, bodyText, mode }) {
    const slotsMatch = /^\/api\/v1\/doctors\/([a-z0-9-]+)\/slots$/.exec(path);
    const lookupMatch = /^\/api\/v1\/appointments\/([^/]+)$/.exec(path);
    const isCreate = path === "/api/v1/appointments" && method === "POST";
    if (!(method === "GET" && (slotsMatch || lookupMatch)) && !isCreate) return null;

    const req = { headers };
    const entry = { method, path: slotsMatch ? "/doctors/{slug}/slots" : lookupMatch ? "/appointments/{reference}" : "/appointments", mode };
    if (isCreate) entry.idempotencyKey = headers["idempotency-key"] ?? null;
    return {
      entry,
      run() {
        if (!secretOk(req)) return { status: 403, body: errorBody("forbidden", "Forbidden.") };

        if (slotsMatch) {
          const doctor = doctors.find((d) => d.slug === slotsMatch[1]);
          if (!doctor) return { status: 404, body: errorBody("not_found", "Doctor not found.") };
          return { status: 200, body: slotsBody(doctor) };
        }

        if (lookupMatch) {
          const ref = parseReference(decodeURIComponent(lookupMatch[1]));
          const view = ref && byReference.get(ref);
          return view ? { status: 200, body: view } : { status: 404, body: errorBody("not_found", "Appointment not found.") };
        }

        if (mode === "rate-limited") {
          return {
            status: 429,
            headers: { "Retry-After": "60" },
            body: errorBody("rate_limited", "Too many requests. Please try again shortly."),
          };
        }

        let body;
        try {
          body = JSON.parse(bodyText);
        } catch {
          body = null;
        }
        if (!body || typeof body !== "object") {
          return { status: 422, body: errorBody("validation_error", "Some request parameters are invalid.", {}, [{ field: "request", issue: "is invalid" }]) };
        }
        if (body.trap) return { status: 400, body: errorBody("request_rejected", "We couldn't process this booking. Please call the clinic.") };

        const key = headers["idempotency-key"];
        if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
          return { status: 422, body: errorBody("validation_error", "Some request parameters are invalid.", {}, [{ field: "idempotencyKey", issue: "has an invalid format" }]) };
        }
        const hash = createHash("sha256")
          .update(JSON.stringify([body.doctorSlug, body.startsAt, body.fullName, body.mobile, body.email ?? null, body.reason ?? null]))
          .digest("hex");
        const previous = results.get(key);
        if (previous) {
          return previous.hash === hash
            ? { status: 201, body: previous.view }
            : { status: 409, body: errorBody("idempotency_key_reused", "This key was already used for different details.") };
        }

        const doctor = doctors.find((d) => d.slug === body.doctorSlug);
        const problems = [];
        if (!doctor) problems.push({ field: "doctorSlug", issue: "is invalid" });
        if (typeof body.fullName !== "string" || body.fullName.trim().length < 2) problems.push({ field: "fullName", issue: "must be at least 2 characters" });
        if (typeof body.mobile !== "string" || !/^(\+92|0092|92|0)?3\d{9}$/.test(body.mobile.replace(/[\s\-.()]/g, ""))) problems.push({ field: "mobile", issue: "has an invalid format" });
        if (body.acceptRules !== true) problems.push({ field: "acceptRules", issue: "must be one of [True]" });
        if (typeof body.startsAt !== "string" || Number.isNaN(Date.parse(body.startsAt))) problems.push({ field: "startsAt", issue: "is invalid" });
        if (problems.length > 0) {
          return { status: 422, body: errorBody("validation_error", "Some request parameters are invalid.", {}, problems) };
        }

        const startsAt = iso(Date.parse(body.startsAt));
        const slot = buildDays(doctor).flatMap((d) => d.slots).find((s) => s.startsAt === startsAt);
        const afterMs = Date.parse(startsAt);

        if (loseNext && slot) {
          // Someone else books this slot first; this request loses the race.
          loseNext = false;
          booked.set(slotKey(doctor.slug, slot.startsAt), { ghost: true });
          return {
            status: 409,
            body: errorBody("slot_taken", "Sorry, this slot was just taken.", { alternatives: alternatives(doctor, afterMs) }),
            resetMode: true,
          };
        }
        if (!slot) {
          const taken = booked.has(slotKey(doctor.slug, startsAt));
          return {
            status: 409,
            body: errorBody(taken ? "slot_taken" : "slot_unavailable", taken ? "Sorry, this slot was just taken." : "That time is no longer available.", {
              alternatives: alternatives(doctor, afterMs),
            }),
          };
        }

        let reference = newReference();
        while (byReference.has(reference)) reference = newReference();
        const record = { reference, doctorSlug: doctor.slug, startsAt: slot.startsAt, endsAt: slot.endsAt, fullName: body.fullName, mobile: body.mobile };
        const view = viewOf(record);
        booked.set(slotKey(doctor.slug, slot.startsAt), record);
        byReference.set(reference, view);
        results.set(key, { hash, view });
        return { status: 201, body: view };
      },
    };
  }

  return {
    handle,
    reset,
    /** The next POST that targets a bookable slot loses the race (mode `slot-taken`). */
    armSlotTaken() {
      loseNext = true;
    },
  };
}
