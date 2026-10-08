// The demo's simulated online bookings (FR-042, ADR-0009). The demo server is read-only and never
// receives these: the browser invents a booking into a free slot later today, so a visitor can watch the
// agenda, the counts and the "New booking" notification react without waiting for real traffic. A first
// one arrives 50 s after the Overview opens, then one every 75 s. The choice of slot and patient is seeded
// by the demo date and the booking's serial number, so a given visit is repeatable.
import { clinicMidnight, formatTime } from "@/admin/lib/format";
import type { AgendaDoctor, BookingDetail, BookingSummary } from "@/admin/lib/schemas";
import { bookingLength, minutesOf } from "@/admin/overview/model";

export const SIM_FIRST_MS = 50_000;
export const SIM_EVERY_MS = 75_000;
/** The next free slots of a doctor the simulation chooses from: a booking made online is for soon. */
const NEAR_SLOTS = 8;

const WOMEN = ["Ayesha", "Fatima", "Hira", "Zara", "Sadia", "Mahnoor", "Nimra", "Amna", "Iqra", "Rabia", "Maryam", "Khadija", "Saba", "Mehwish", "Noor", "Areeba", "Javeria", "Sana"];
const MEN = ["Bilal", "Usman", "Ahmed", "Kamran", "Hamza", "Faraz", "Saad", "Danish", "Talha", "Yasir", "Ali", "Junaid", "Fahad", "Waqas", "Zubair", "Asad"];
const GIRLS = ["Inaya", "Hoorain", "Anaya", "Eshal", "Haniya", "Alishba", "Zoya", "Fiza", "Minahil", "Aiza"];
const BOYS = ["Ayaan", "Zayan", "Rayyan", "Musa", "Arham", "Ibrahim", "Abdullah", "Hadi", "Shayan", "Azlan"];
const SURNAMES = ["Khan", "Siddiqui", "Tariq", "Shah", "Raza", "Hussain", "Malik", "Iqbal", "Javed", "Aslam", "Butt", "Rehman", "Nadeem", "Akhtar", "Anwar", "Latif", "Baig", "Zaidi"];

type Who = "adult" | "woman" | "child";
const PROFILES: Record<string, { who: Who; age: [number, number]; reasons: string[] }> = {
  "General Medicine": { who: "adult", age: [18, 70], reasons: ["Fever and cough", "Blood pressure review", "Follow-up visit", "Routine check-up", "Prescription renewal", "Skin rash", "Annual review"] },
  Cardiology: { who: "adult", age: [38, 78], reasons: ["Chest discomfort", "ECG review", "Blood pressure review", "Palpitations", "Follow-up after echo"] },
  Pediatrics: { who: "child", age: [0, 12], reasons: ["Vaccination", "Fever", "Growth check", "Ear pain", "Well-child check-up", "Cough and cold"] },
  Gynecology: { who: "woman", age: [21, 46], reasons: ["Antenatal check-up", "Ultrasound review", "Follow-up visit", "Annual check-up", "Menstrual concerns"] },
  Dermatology: { who: "adult", age: [14, 65], reasons: ["Acne review", "Skin rash", "Hair fall", "Follow-up visit", "Mole check", "Eczema flare-up"] },
  Dental: { who: "adult", age: [16, 72], reasons: ["Tooth pain", "Scale and polish", "Filling", "Dental check-up", "Braces review"] },
  "Pathology Lab": { who: "adult", age: [18, 75], reasons: ["Blood test review", "Sample collection", "Report discussion", "Thyroid profile review", "Diabetes screening"] },
};
const FALLBACK = PROFILES["General Medicine"]!;
/** The sample catalogue's fees by department, for the drawer of a simulated booking. */
const FEES: Record<string, number> = { "General Medicine": 2000, Cardiology: 3500, Pediatrics: 2500, Gynecology: 3000, Dermatology: 2200, Dental: 2000, "Pathology Lab": 1500 };
const SAFE_CHARACTERS = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O, 1/I/L

export type SimulatedBooking = { summary: BookingSummary; detail: BookingDetail };

export type SimulationInput = {
  /** The clinic date of the demo day, `YYYY-MM-DD`. */
  date: string;
  timeZone: string;
  /** The agenda as it is now, simulated bookings included, so a slot is never offered twice. */
  agenda: readonly AgendaDoctor[];
  nowMs: number;
  /** 1 for the first simulated booking, then 2, ... */
  serial: number;
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

/** Free slots of a doctor today that start after `nowMs`, soonest first. Cancelled bookings free their slot. */
export function freeSlots(row: AgendaDoctor, midnightMs: number, nowMs: number, length: number): number[] {
  const taken = new Set(row.items.filter((item) => item.status !== "cancelled").map((item) => Date.parse(item.startsAt)));
  const slots: number[] = [];
  for (const session of row.sessions) {
    for (let minute = minutesOf(session.start); minute + length <= minutesOf(session.end); minute += length) {
      const startsAt = midnightMs + minute * 60_000;
      if (startsAt > nowMs && !taken.has(startsAt)) slots.push(startsAt);
    }
  }
  return slots.sort((a, b) => a - b);
}

/** A new online booking in a free future slot of some doctor, or null when the day has none left. */
export function simulateBooking({ date, timeZone, agenda, nowMs, serial }: SimulationInput): SimulatedBooking | null {
  const random = seededRandom(`shuaib-health-demo-sim:v1:${date}:${serial}`);
  const length = agenda.flatMap((row) => row.items).map(bookingLength)[0] ?? 15;
  const midnight = clinicMidnight(date, timeZone);
  const open = agenda.map((row) => ({ row, slots: freeSlots(row, midnight, nowMs, length) })).filter((entry) => entry.slots.length > 0);
  if (open.length === 0) return null;

  const { row, slots } = pick(random, open);
  const startsAt = pick(random, slots.slice(0, NEAR_SLOTS));
  const department = row.doctor.departmentName;
  const profile = PROFILES[department] ?? FALLBACK;

  const female = profile.who === "woman" ? true : random() < 0.5;
  const first = profile.who === "child" ? pick(random, female ? GIRLS : BOYS) : pick(random, female ? WOMEN : MEN);
  const last = pick(random, SURNAMES);
  const age = profile.age[0] + Math.floor(random() * (profile.age[1] - profile.age[0] + 1));
  const bookedBy = profile.who === "child" ? (random() < 0.7 ? "mother" : "father") : undefined;
  const reason = pick(random, profile.reasons);
  const code = Array.from({ length: 8 }, () => pick(random, [...SAFE_CHARACTERS])).join("");
  const reference = `DX${code}`;
  const phoneTail = String(Math.floor(random() * 1000)).padStart(3, "0");

  const bookedAt = new Date(nowMs).toISOString();
  const summary: BookingSummary = {
    reference,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + length * 60_000).toISOString(),
    localDate: date,
    localTime: formatTime(startsAt, timeZone),
    status: "confirmed",
    version: 1,
    patientNameMasked: `${first} ${last.charAt(0)}.`,
    phoneMasked: `03${pick(random, ["00", "01", "15", "21", "31", "33"])}****${phoneTail}`,
    doctor: row.doctor,
    allowedNext: [],
    isSample: true,
  };
  const detail: BookingDetail = {
    ...summary,
    patientName: `${first} ${last}`,
    emailMasked: `${first.charAt(0).toLowerCase()}****@e****.com`,
    reason,
    patientAge: profile.who === "child" ? age : undefined,
    bookedBy,
    feePkr: FEES[department] ?? 2000,
    bookedAt,
    history: [{ at: bookedAt, toStatus: "confirmed", actor: "Online booking", isUndo: false }],
  };
  return { summary, detail };
}

type Timers = {
  setTimeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
};

/** Calls `run` 50 s from now and then every 75 s, until the returned function stops it. */
export function startSimulation(run: () => void, timers: Timers = { setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (handle) => clearTimeout(handle) }): () => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const schedule = (ms: number) => {
    handle = timers.setTimeout(() => {
      if (stopped) return;
      run();
      schedule(SIM_EVERY_MS);
    }, ms);
  };
  schedule(SIM_FIRST_MS);
  return () => {
    stopped = true;
    if (handle !== null) timers.clearTimeout(handle);
  };
}
