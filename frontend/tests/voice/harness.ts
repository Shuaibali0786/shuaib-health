// A scripted voice conversation for tests (Feature 013). No microphone, no network, no production: the doctor's
// free times and the booking route are fakes, so a script runs the real router, guards and booking dialog.
import { buildKnowledgePack } from "@/agent/knowledge";
import { getProvider } from "@/agent/registry";
import type { KnowledgePack } from "@/agent/types";
import type { BookingAnswer } from "@/lib/booking/client";
import type { DoctorSlots } from "@/lib/booking/schemas";
import { faqGroups } from "@/data/faq";
import { newBookingState, type BookingPayload, type BookingState, type DialogDeps } from "@/voice/bookingDialog";
import { routeTurn, type RouterContext, type RouterResult } from "@/voice/router";
import type { VoiceLang } from "@/voice/types";

import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";

/** Sunday 8 November 2026, 15:00 in Karachi. */
export const NOW = new Date("2026-11-08T10:00:00Z");

export const packFor = (demo: boolean): KnowledgePack => buildKnowledgePack({ site: siteConfig, departments, doctors, labTests, packages: healthPackages, faqGroups, demo });

const pad = (n: number) => String(n).padStart(2, "0");
const instant = (date: string, time: string) => new Date(`${date}T${time}:00+05:00`).toISOString().replace(".000Z", "Z");

/** 14 days from today: Sundays are off; Fridays offer four times, other days three. */
export function fakeSlots(doctorSlug: string, taken: ReadonlySet<string> = new Set()): DoctorSlots {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 8 + i));
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const weekday = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[d.getUTCDay()] as "sun";
    if (weekday === "sun") return { date, weekday, status: "not_working" as const, slots: [] };
    const times = weekday === "fri" ? ["09:00", "11:30", "14:00", "16:30"] : ["10:00", "11:30", "15:00"];
    const slots = times.filter((t) => !taken.has(`${doctorSlug}|${date}|${t}`)).map((t) => ({ startsAt: instant(date, t), endsAt: instant(date, t), localTime: t }));
    return { date, weekday, status: slots.length ? ("available" as const) : ("fully_booked" as const), slots };
  });
  return { doctorSlug, timeZone: "Asia/Karachi", windowDays: 14, generatedAt: NOW.toISOString().replace(".000Z", "Z"), days };
}

export type SubmitMode = "ok" | "taken-once" | "limit" | "rate" | "down-once" | "throw-once" | "rejected";

export function makeWorld(options: { mode?: SubmitMode; lang?: VoiceLang; guide?: boolean; unavailable?: boolean } = {}) {
  const pack = packFor(Boolean(options.guide));
  const submits: Array<{ payload: BookingPayload; key: string }> = [];
  const taken = new Set<string>();
  let attempts = 0;
  const deps: DialogDeps = {
    pack,
    now: () => NOW,
    newKey: () => `key-${submits.length + attempts + 1}`,
    fetchSlots: async (slug) => {
      if (options.unavailable) throw new Error("down");
      return fakeSlots(slug, taken);
    },
    submit: async (payload, key): Promise<BookingAnswer> => {
      attempts += 1;
      submits.push({ payload, key });
      const mode = options.mode ?? "ok";
      if (mode === "throw-once" && attempts === 1) throw new Error("network");
      if (mode === "down-once" && attempts === 1) return { status: 503, body: null, retryAfter: null };
      if (mode === "limit") return { status: 409, body: { error: { code: "booking_limit_reached", message: "limit", requestId: "r" } }, retryAfter: null };
      if (mode === "rate") return { status: 429, body: { error: { code: "rate_limited", message: "slow down", requestId: "r" } }, retryAfter: 60 };
      if (mode === "rejected") return { status: 400, body: { error: { code: "request_rejected", message: "no", requestId: "r" } }, retryAfter: null };
      if (mode === "taken-once" && attempts === 1) {
        const date = payload.startsAt.slice(0, 10);
        taken.add(`${payload.doctorSlug}|${date}|11:30`);
        return {
          status: 409,
          body: { error: { code: "slot_taken", message: "taken", requestId: "r" }, alternatives: [{ startsAt: payload.startsAt, endsAt: payload.startsAt, localDate: date, localTime: "14:00" }] },
          retryAfter: null,
        };
      }
      const doctor = pack.doctors.find((d) => d.slug === payload.doctorSlug);
      const local = new Date(new Date(payload.startsAt).getTime() + 5 * 3600_000).toISOString();
      return {
        status: 201,
        retryAfter: null,
        body: {
          reference: "7K3M9P2QXA",
          status: "confirmed",
          doctor: { slug: payload.doctorSlug, fullName: doctor?.name ?? "Dr", specialty: doctor?.specialty ?? "" },
          department: { slug: doctor?.departmentSlug ?? "x", name: doctor?.departmentName ?? "X" },
          startsAt: payload.startsAt,
          endsAt: payload.startsAt,
          localDate: local.slice(0, 10),
          localTime: local.slice(11, 16),
          timeZone: "Asia/Karachi",
          feePkr: doctor?.feePkr ?? 0,
          patientNameMasked: "A**** R****",
          mobileMasked: "0300****567",
          bookedAt: NOW.toISOString().replace(".000Z", "Z"),
          isSample: true,
        },
      };
    },
  };

  const ctx: RouterContext = { pack, mode: options.guide ? "guide" : "patient", lang: options.lang ?? "en", provider: getProvider(pack, "local"), deps, booking: null as BookingState | null, offerDoctor: false, bookingsMade: 0 };
  const log: RouterResult[] = [];

  async function say(text: string, opts: { confirmable?: boolean } = {}): Promise<RouterResult> {
    const out = await routeTurn(ctx, { text, confirmable: opts.confirmable ?? true });
    ctx.booking = out.booking;
    ctx.offerDoctor = out.offerDoctor;
    ctx.lang = out.lang;
    if (out.booked) ctx.bookingsMade += 1;
    log.push(out);
    return out;
  }

  return { pack, ctx, submits, say, log, newBooking: newBookingState };
}
