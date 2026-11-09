// The hands-free booking conversation (Feature 013, spec FR-020..FR-049, data-model §1).
//
// A pure state machine: every network call comes in through `deps`, so the whole dialog is tested with scripts.
// Rules this file keeps:
//   * It never asks for a detail it already has, and a correction at any time is applied and confirmed in one sentence.
//   * A time is only ever one of the free slots the server listed. It never invents or promises a slot.
//   * It reads everything back (phone digit by digit) and books ONLY on a clear spoken or typed "yes" in the NEXT
//     caller turn, and only when that turn did not overlap the read-back (`confirmable`).
//   * It books once per conversation, through the same public route as the website form.

import type { KnowledgePack } from "@/agent/types";
import { AppointmentViewSchema, BookingConflictSchema, type AppointmentView, type DoctorSlots } from "@/lib/booking/schemas";
import type { BookingAnswer } from "@/lib/booking/client";
import { formatPkr } from "@/lib/format";

import { groupPhone, groupReference, speakEmail, speakPhone, speakReference } from "./chunk";
import { clinicClosedOn, doctorsOf, findDepartment, findDoctors, labDepartment, labItem, resolveLabTest } from "./entities";
import { T } from "./phrases";
import { parseDate, speakDate, speakTime } from "./parse/date";
import { cleanReason, declines, extractEmail, extractName } from "./parse/name";
import { extractPhone, RESTART_NUMBER, spokenDigits, withoutPhone } from "./parse/phone";
import { parseTimes } from "./parse/time";
import { parseYesNo } from "./parse/yesno";
import { EMPTY_DRAFT, type BookingDraft, type BookingPhase, type VoiceLang } from "./types";
import { complains } from "./understand";

export type Ask = "fullName" | "nameCheck" | "phone" | "reason" | "doctor" | "date" | "time" | "email" | "partOfDay" | null;

export type BookingState = {
  phase: BookingPhase;
  draft: BookingDraft;
  asking: Ask;
  slots: Record<string, DoctorSlots>;
  /** Two readings of an unclear time ("3" could be 03:00 or 15:00), waiting for "morning or evening". */
  pendingTimes: string[];
  /** The idempotency key of this booking attempt; kept so a retry after a timeout is the same attempt. */
  key: string | null;
  /** The server's own clock (from the slot list), so "the 13th" and "tomorrow" mean the clinic's days, not the phone's. */
  serverNow: string | null;
  booked: AppointmentView | null;
  /** How many turns in a row did not answer the question being asked (two or more: offer tappable choices). */
  misses: number;
  /** The name was heard in Urdu letters and written in English letters: ask "Spelling theek hai?" once. */
  nameCheck?: boolean;
  /** The patient said the spelling was wrong: ask them to type it. */
  typeName?: boolean;
  /** Tries at the mobile number that did not give one (owner's rule: read back once, never loop more than twice). */
  phoneTries?: number;
  /** The digits heard on the last try that did not make a mobile number, read back once. */
  phoneHeard?: string;
};

/**
 * A fresh booking. `prefill` carries what the conversation already knows (the doctor or department, or the lab test as
 * the reason). The reason is never asked for: it comes from the conversation, or stays empty (it is optional).
 */
export const newBookingState = (prefill: Partial<BookingDraft> = {}): BookingState => ({
  phase: "collecting",
  draft: { ...EMPTY_DRAFT, reasonAnswered: true, ...prefill },
  asking: null,
  slots: {},
  pendingTimes: [],
  key: null,
  booked: null,
  serverNow: null,
  misses: 0,
});

export type DialogDeps = {
  pack: KnowledgePack;
  now: () => Date;
  fetchSlots: (doctorSlug: string) => Promise<DoctorSlots>;
  submit: (payload: BookingPayload, key: string) => Promise<BookingAnswer>;
  newKey: () => string;
};

export type BookingPayload = {
  doctorSlug: string;
  startsAt: string;
  fullName: string;
  mobile: string;
  email: string | null;
  reason: string | null;
  acceptRules: true;
  trap: null;
};

export type DialogReply = {
  state: BookingState;
  /** What is shown. */
  text: string;
  /** What is spoken, when it differs (phone digits, references and emails read out). */
  spoken?: string;
  links?: Array<{ label: string; href: string }>;
  /** Set once, when the booking succeeded. */
  booked?: AppointmentView;
  /** True when this reply is the read-back, so the session can arm the "yes" after it is spoken. */
  readBack?: boolean;
  /** Two to four short answers the patient can tap (or say) instead of answering in their own words. */
  options?: string[];
  /** A field to type the answer into, shown under the reply (the mobile number: a numeric keypad on phones). */
  input?: "phone";
};

type Input = {
  text: string;
  lang: VoiceLang;
  /** The caller's turn did not overlap the read-back being spoken. */
  confirmable: boolean;
  /** The turn was heard in Urdu letters (already written in English letters in `text`): a name from it is checked. */
  script?: boolean;
};

const FIELD_LABELS = {
  fullName: ["name", "naam"],
  phone: ["phone", "number", "mobile"],
  doctor: ["doctor", "doc"],
  date: ["date", "tareekh", "day", "din"],
  time: ["time", "waqt"],
  email: ["email", "mail"],
  reason: ["reason", "wajah"],
} as const;
const WRONG = /\b(galat|ghalat|ghalti|wrong|incorrect|change|badal|badlo|badalna|mistake|not right|theek nahi|thik nahi)\b/;

const first = (name: string) => name.split(" ")[0] ?? name;
/** "03245266" is read back as "0324 526 6": four digits, then threes. */
const groupDigits = (digits: string) => [digits.slice(0, 4), ...(digits.slice(4).match(/\d{1,3}/g) ?? [])].filter(Boolean).join(" ");
const doctorOf = (pack: KnowledgePack, slug: string | null) => (slug ? pack.doctors.find((d) => d.slug === slug) : undefined);

function withDraft(state: BookingState, patch: Partial<BookingDraft>, corrected?: BookingDraft["corrected"][number]): BookingState {
  const draft = { ...state.draft, ...patch };
  const marks = corrected && !state.draft.corrected.includes(corrected) ? [...state.draft.corrected, corrected] : state.draft.corrected;
  return { ...state, draft: { ...draft, corrected: marks } };
}

// --- Slots --------------------------------------------------------------------------------------------

async function slotsFor(state: BookingState, doctorSlug: string, deps: DialogDeps, refresh = false): Promise<{ state: BookingState; slots: DoctorSlots | null }> {
  const cached = state.slots[doctorSlug];
  if (cached && !refresh) return { state, slots: cached };
  try {
    const slots = await deps.fetchSlots(doctorSlug);
    return { state: { ...state, slots: { ...state.slots, [doctorSlug]: slots }, serverNow: slots.generatedAt }, slots };
  } catch {
    return { state, slots: null };
  }
}

const dayOf = (slots: DoctorSlots, date: string) => slots.days.find((d) => d.date === date);

/** Up to four times spread across the day, so the caller hears a useful choice, not twelve numbers. */
function spread(times: string[], count = 4): string[] {
  if (times.length <= count) return times;
  const picks = new Set<number>();
  for (let i = 0; i < count; i += 1) picks.add(Math.round((i * (times.length - 1)) / (count - 1)));
  return [...picks].map((i) => times[i] as string);
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const joinList = (items: string[], lang: VoiceLang) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${T(lang, "and", "aur")} ${items.at(-1)}`);

function openDays(slots: DoctorSlots): string[] {
  return slots.days.filter((d) => d.status === "available" && d.slots.length > 0).map((d) => d.date);
}

function dayProblem(status: string, date: string, lang: VoiceLang): string {
  const when = speakDate(date);
  switch (status) {
    case "fully_booked":
      return T(lang, `${when} is fully booked.`, `${when} ko saare slots book hain.`);
    case "clinic_closed":
      return T(lang, `The clinic is closed on ${when}.`, `${when} ko clinic band hai.`);
    case "no_longer_available":
      return T(lang, `There are no times left on ${when}.`, `${when} ko ab koi waqt baqi nahi.`);
    default:
      return T(lang, `The doctor isn't available on ${when}.`, `${when} ko doctor available nahi hain.`);
  }
}

// --- Reading what the caller said ---------------------------------------------------------------------

type Change = { field: keyof typeof FIELD_LABELS; was: boolean };

type Applied = { state: BookingState; changes: Change[]; phoneProblem: "partial" | "invalid" | "unheard" | null; ambiguousDoctors: string[] };

function clearRequested(state: BookingState, text: string): BookingState {
  const t = text.toLowerCase();
  if (!WRONG.test(t)) return state;
  let next = state;
  const has = (field: keyof typeof FIELD_LABELS) => FIELD_LABELS[field].some((k) => new RegExp(`\\b${k}\\b`).test(t));
  if (has("phone")) next = withDraft(next, { phone: null, phonePartial: "" });
  else if (has("fullName")) next = withDraft(next, { fullName: null });
  else if (has("doctor")) next = withDraft(next, { doctorSlug: null, startsAt: null });
  else if (has("date")) next = withDraft(next, { date: null, startsAt: null });
  else if (has("time")) next = withDraft(next, { time: null, startsAt: null });
  else if (has("email")) next = withDraft(next, { email: null, emailAnswered: false });
  else if (has("reason")) next = withDraft(next, { reason: null, reasonAnswered: false });
  return next;
}

function applyUtterance(start: BookingState, text: string, deps: DialogDeps, script = false): Applied {
  const { pack } = deps;
  let state = clearRequested(start, text);
  const changes: Change[] = [];
  /** What the caller had told us BEFORE this turn: a "correction" is a new value for something already given. */
  const orig = start.draft;
  let phoneProblem: Applied["phoneProblem"] = null;
  let ambiguousDoctors: string[] = [];
  const asking = state.asking;
  const draft = () => state.draft;

  // "Maine naam Shuaib Ali likha hai. Spelling theek hai?"
  if (asking === "nameCheck") {
    const yes = parseYesNo(text) === "yes" || /^(ji|jee|haan|han|ok|okay|sahi|theek|thik|correct|right)\b/i.test(text.trim()) && !/\b(nahi|nahin|no|galat|ghalat|wrong)\b/i.test(text);
    const typed = !script ? extractName(text, true) : null;
    if (yes) {
      changes.push({ field: "fullName", was: false });
      return { state: { ...state, nameCheck: false, typeName: false }, changes, phoneProblem, ambiguousDoctors };
    }
    if (typed && !/\b(nahi|nahin|no|galat|ghalat|wrong)\b/i.test(text)) {
      changes.push({ field: "fullName", was: true });
      return { state: { ...withDraft(state, { fullName: typed }, "fullName"), nameCheck: false, typeName: false }, changes, phoneProblem, ambiguousDoctors };
    }
    if (/\b(nahi|nahin|no|galat|ghalat|wrong|change)\b/i.test(text)) {
      changes.push({ field: "fullName", was: true });
      return { state: { ...withDraft(state, { fullName: null }), nameCheck: false, typeName: true }, changes, phoneProblem, ambiguousDoctors };
    }
  }

  // Name first: a patient called "Sana" must not be taken for "Dr. Sana Farooqui".
  const name = extractName(text, asking === "fullName" || asking === "nameCheck");
  if (name) {
    if (orig.fullName !== name) changes.push({ field: "fullName", was: orig.fullName !== null });
    state = withDraft(state, { fullName: name }, orig.fullName && orig.fullName !== name ? "fullName" : undefined);
    // Heard in Urdu letters: written in English letters, so the patient checks the spelling once.
    state = { ...state, nameCheck: script, typeName: false };
  }

  const emailWanted = asking === "email" || /@|\bemail\b|\bgmail\b|\bhotmail\b|\byahoo\b|\bat the rate\b|\bdot com\b/i.test(text);
  if (emailWanted) {
    if (asking === "email" && declines(text)) {
      state = withDraft(state, { email: null, emailAnswered: true });
    } else {
      const email = extractEmail(text);
      if (email) {
        if (orig.email !== email) changes.push({ field: "email", was: orig.email !== null });
        state = withDraft(state, { email, emailAnswered: true }, orig.email && orig.email !== email ? "email" : undefined);
      }
    }
  }

  const digits = spokenDigits(text).replace(/\D/g, "");
  if (asking === "phone" || digits.length >= 7 || /\b(phone|mobile|number|raabta)\b/i.test(text)) {
    // While the number is asked, misheard digit words count ("Thi", "Fa", "double S"); "phir se" starts it over.
    const fuzzy = asking === "phone";
    if (fuzzy && RESTART_NUMBER.test(text)) state = withDraft(state, { phonePartial: "" });
    const heard = extractPhone(text, draft().phonePartial, { fuzzy });
    if (heard.status === "complete") {
      if (orig.phone !== heard.e164) changes.push({ field: "phone", was: orig.phone !== null });
      state = withDraft(state, { phone: heard.e164, phonePartial: "" }, orig.phone && orig.phone !== heard.e164 ? "phone" : undefined);
      state = { ...state, phoneTries: 0 };
    } else if (heard.status === "partial" && (asking === "phone" || digits.length >= 4)) {
      phoneProblem = "partial";
      state = withDraft(state, { phonePartial: heard.digits });
    } else if (heard.status === "invalid") {
      phoneProblem = "invalid";
      state = withDraft(state, { phonePartial: "" });
    } else if (asking === "phone" && !RESTART_NUMBER.test(text)) {
      phoneProblem = "unheard";
    }
    if (phoneProblem && asking === "phone") {
      const heardNow = heard.status === "partial" || heard.status === "invalid" ? heard.digits : "";
      state = { ...state, phoneTries: (state.phoneTries ?? 0) + 1, phoneHeard: heardNow };
    }
  }

  // What is left of the sentence once the phone number and the caller's own name are taken out: the doctor,
  // the day and the time are read from this, so "I'm Sana, 0300..., see Dr Bilal friday 11:30" works whole.
  let rest = withoutPhone(text);
  if (name) for (const part of name.split(" ")) rest = rest.replace(new RegExp(part, "gi"), " ");

  // While a personal detail is asked (name, phone, email), the answer is only that detail: "ayesha at gmail dot com"
  // must not pick Dr. Ayesha, and "0300..." is not a time. A clear change ("date galat hai, friday karo") still counts.
  const detailOnly = (asking === "fullName" || asking === "email" || asking === "phone" || asking === "nameCheck") && !WRONG.test(text.toLowerCase());
  if (detailOnly) return { state, changes, phoneProblem, ambiguousDoctors };

  // A lab test named at any point ("CBC", "blood test", "khoon ka test") books the lab and its doctor: never asked again.
  if (!draft().doctorSlug && !draft().labTestSlug) {
    const test = resolveLabTest(rest, pack);
    const lab = test ? labDepartment(pack) : null;
    if (test && lab) {
      const only = lab.doctors.length === 1 ? lab.doctors[0] : undefined;
      state = withDraft(state, { departmentSlug: lab.slug, doctorSlug: only?.slug ?? null, labTestSlug: test.slug, reason: `${test.name} test`, startsAt: null });
      if (only) changes.push({ field: "doctor", was: false });
    }
  }

  // Doctor or department.
  {
    const doctors = findDoctors(rest, pack);
    const picked = doctors.length === 1 ? doctors[0] : undefined;
    if (picked) {
      if (orig.doctorSlug !== picked.slug) changes.push({ field: "doctor", was: orig.doctorSlug !== null });
      const changed = orig.doctorSlug !== null && orig.doctorSlug !== picked.slug;
      state = withDraft(state, { doctorSlug: picked.slug, departmentSlug: picked.departmentSlug, startsAt: null }, changed ? "doctorSlug" : undefined);
    } else if (doctors.length > 1) {
      ambiguousDoctors = doctors.map((d) => d.name);
    } else {
      // A symptom may choose the department only while none is chosen; a named department can always change it.
      const department = findDepartment(rest, pack, { symptoms: draft().departmentSlug === null });
      if (department && department !== draft().departmentSlug && !draft().doctorSlug) {
        const team = doctorsOf(department, pack);
        state = withDraft(state, { departmentSlug: department });
        if (team.length === 1 && team[0]) {
          changes.push({ field: "doctor", was: false });
          state = withDraft(state, { doctorSlug: team[0].slug, startsAt: null });
        }
      }
    }
  }

  // Date and time.
  {
    const date = parseDate(rest, start.serverNow ? new Date(start.serverNow) : deps.now(), asking === "date");
    if (date) {
      if (orig.date !== date) changes.push({ field: "date", was: orig.date !== null });
      state = withDraft(state, { date, startsAt: null }, orig.date && orig.date !== date ? "date" : undefined);
    }
    const times = parseTimes(rest, asking === "time" || asking === "partOfDay");
    if (times.length) {
      state = { ...state, pendingTimes: times, draft: { ...state.draft, startsAt: null } };
    }
  }

  // Morning or evening, after an unclear time.
  if (state.pendingTimes.length > 1) {
    const sorted = [...state.pendingTimes].sort();
    if (/\b(morning|subah|subha|am|a m|savere)\b/i.test(text)) state = { ...state, pendingTimes: [sorted[0] as string] };
    else if (/\b(evening|shaam|sham|afternoon|dopahar|raat|night|pm|p m)\b/i.test(text)) state = { ...state, pendingTimes: [sorted.at(-1) as string] };
  }

  if (asking === "reason") {
    if (declines(text)) state = withDraft(state, { reason: null, reasonAnswered: true });
    else {
      const reason = cleanReason(text);
      if (reason) state = withDraft(state, { reason, reasonAnswered: true });
    }
  }
  return { state, changes, phoneProblem, ambiguousDoctors };
}

// --- Slot settling: turn doctor + date + time into one real free slot ---------------------------------

type Settled = { state: BookingState; message: string | null };

async function settle(start: BookingState, deps: DialogDeps, lang: VoiceLang): Promise<Settled> {
  let state = start;
  const { doctorSlug, date } = state.draft;
  // A day the clinic is closed (Sunday) is never kept, even before a doctor is chosen.
  if (date && clinicClosedOn(deps.pack, date)) {
    state = { ...withDraft(state, { date: null, time: null, startsAt: null }), pendingTimes: [] };
    return { state, message: T(lang, `The clinic is closed on ${speakDate(date)}.`, `${speakDate(date)} ko clinic band hai.`) };
  }
  if (!doctorSlug) return { state, message: null };
  const loaded = await slotsFor(state, doctorSlug, deps);
  state = loaded.state;
  if (!loaded.slots) return { state, message: T(lang, "I couldn't load the doctor's free times just now. Please try again in a moment, or call the clinic.", "Doctor ke khali waqt abhi load nahi hue. Zara der baad koshish karein ya clinic ko call karein.") };
  const slots = loaded.slots;
  if (!date) {
    // A time without a date waits for the date.
    return { state, message: null };
  }
  const day = dayOf(slots, date);
  if (!day) {
    state = withDraft(state, { date: null, startsAt: null });
    state = { ...state, pendingTimes: [] };
    return { state, message: T(lang, `I can only book within the next ${slots.windowDays} days.`, `Main agle ${slots.windowDays} din ke andar hi book kar sakti hoon.`) };
  }
  if (day.status !== "available" || day.slots.length === 0) {
    state = withDraft(state, { date: null, startsAt: null });
    state = { ...state, pendingTimes: [] };
    return { state, message: dayProblem(day.status, date, lang) };
  }
  const free = day.slots.map((s) => s.localTime);
  const want = state.pendingTimes.length ? state.pendingTimes : state.draft.time ? [state.draft.time] : [];
  if (want.length === 0) return { state: withDraft(state, { time: null, startsAt: null }), message: null };
  const matches = want.filter((t) => free.includes(t));
  if (matches.length === 1) {
    const time = matches[0] as string;
    const slot = day.slots.find((s) => s.localTime === time);
    return { state: { ...withDraft(state, { time, startsAt: slot?.startsAt ?? null }), pendingTimes: [] }, message: null };
  }
  if (matches.length > 1) {
    return { state: { ...withDraft(state, { time: null, startsAt: null }), pendingTimes: matches, asking: "partOfDay" }, message: null };
  }
  // None of the readings is free: say so and offer the nearest real times.
  const target = minutes((want[0] as string) ?? "12:00");
  const nearest = [...free].sort((a, b) => Math.abs(minutes(a) - target) - Math.abs(minutes(b) - target)).slice(0, 3).sort();
  const wanted = speakTime(want[0] as string);
  return {
    state: { ...withDraft(state, { time: null, startsAt: null }), pendingTimes: [] },
    message: T(lang, `${wanted} isn't free on ${speakDate(date)}. The nearest free times are ${joinList(nearest.map(speakTime), lang)}.`, `${wanted} par ${speakDate(date)} ko slot khali nahi. Qareeb ke khali waqt ${joinList(nearest.map(speakTime), lang)} hain.`),
  };
}

// --- What to ask next -----------------------------------------------------------------------------------

function nextAsk(state: BookingState): Ask {
  const d = state.draft;
  // One item at a time, in the order a receptionist asks: who to see, when, then the patient's details.
  if (!d.doctorSlug) return "doctor";
  if (!d.date) return "date";
  if (!d.startsAt) return state.pendingTimes.length > 1 ? "partOfDay" : "time";
  if (!d.fullName) return "fullName";
  if (state.nameCheck) return "nameCheck";
  if (!d.phone) return "phone";
  if (!d.emailAnswered) return "email";
  return null;
}

function question(state: BookingState, deps: DialogDeps, lang: VoiceLang, ask: Ask, problem: Applied["phoneProblem"], ambiguous: string[]): string {
  const { pack } = deps;
  const d = state.draft;
  const slots = d.doctorSlug ? state.slots[d.doctorSlug] : undefined;
  switch (ask) {
    case "fullName":
      if (state.typeName) return T(lang, "No problem. Please type your name in English letters in the box below.", "Koi baat nahi. Apna naam neeche box mein English letters mein likh dein.");
      return T(lang, "May I have your full name, please?", "Aap ka poora naam kya hai?");
    case "nameCheck":
      return T(lang, `I've written your name as ${d.fullName}. Is the spelling right?`, `Maine aap ka naam ${d.fullName} likha hai. Spelling theek hai?`);
    case "phone": {
      const either = T(lang, "You can say the number or type it below.", "Aap number bol sakte hain ya neeche likh bhi sakte hain.");
      const tries = state.phoneTries ?? 0;
      if (problem && tries >= 2) {
        // Never a third "please say it again": the typed field is the calm way through.
        return T(lang, "I'm having trouble hearing the number. Please type it in the box below: 11 digits starting with 03.", "Mujhe number theek se sunai nahi de raha. Barah-e-meherbani neeche box mein likh dein: 03 se shuru hone wale 11 digits.");
      }
      if (problem) {
        // Once: what was heard, read back, and both ways to answer.
        const heard = state.phoneHeard ? groupDigits(state.phoneHeard) : "";
        const said = heard ? T(lang, `I heard ${heard}.`, `Maine ${heard} suna.`) : T(lang, "I couldn't hear the number clearly.", "Mujhe number saaf sunai nahi diya.");
        const rule = T(lang, "A mobile number has 11 digits and starts with 03.", "Mobile number 11 digits ka hota hai aur 03 se shuru hota hai.");
        const next = problem === "partial" && heard ? T(lang, "Say the rest, or the whole number again, or type it below.", "Baaqi number bata dein, ya poora number dobara, ya neeche likh dein.") : T(lang, "Please say it once more, or type it in the box below.", "Ek dafa phir bol dein, ya neeche box mein likh dein.");
        return [said, rule, next].join(" ");
      }
      return `${T(lang, "What is your mobile number? Please say the digits slowly.", "Aap ka mobile number kya hai? Aahista aahista digits bata dein.")} ${either}`;
    }
    case "reason":
      return T(lang, "What is the visit for? A few words are fine.", "Visit ki wajah kya hai? Chand alfaaz kaafi hain.");
    case "doctor": {
      if (ambiguous.length) return T(lang, `I have ${joinList(ambiguous, lang)}. Which one do you mean?`, `Mere paas ${joinList(ambiguous, lang)} hain. Aap ka matlab kaun sa hai?`);
      const team = d.departmentSlug ? doctorsOf(d.departmentSlug, pack) : [];
      const dept = pack.departments.find((x) => x.slug === d.departmentSlug)?.name;
      if (team.length > 1) return T(lang, `${dept} has ${joinList(team.map((x) => x.name), lang)}. Which doctor would you like?`, `${dept} mein ${joinList(team.map((x) => x.name), lang)} hain. Kaun se doctor se milna chahte hain?`);
      return T(lang, "Which doctor or department would you like to see?", "Aap kis doctor ya department se milna chahte hain?");
    }
    case "date": {
      const doc = doctorOf(pack, d.doctorSlug);
      const days = slots ? openDays(slots).slice(0, 3).map(speakDate) : [];
      const who = doc ? doc.name : T(lang, "the doctor", "doctor");
      return days.length
        ? T(lang, `Which day suits you? ${who} has free times on ${joinList(days, lang)}.`, `Kaun sa din theek rahega? ${who} ke khali waqt ${joinList(days, lang)} ko hain.`)
        : T(lang, "Which day suits you?", "Kaun sa din theek rahega?");
    }
    case "time": {
      const day = slots && d.date ? dayOf(slots, d.date) : undefined;
      const times = day ? spread(day.slots.map((s) => s.localTime)).map(speakTime) : [];
      return times.length
        ? T(lang, `On ${speakDate(d.date as string)} I have ${joinList(times, lang)}. Which time suits you?`, `${speakDate(d.date as string)} ko mere paas ${joinList(times, lang)} hain. Kaun sa waqt theek rahega?`)
        : T(lang, "Which time suits you?", "Kaun sa waqt theek rahega?");
    }
    case "partOfDay":
      return T(lang, `Do you mean ${joinList([...state.pendingTimes].sort().map(speakTime), lang)}? Please say morning or evening.`, `Aap ka matlab ${joinList([...state.pendingTimes].sort().map(speakTime), lang)} hai? Subah ya shaam bata dein.`);
    case "email":
      return T(lang, "Would you like to add an email? It's optional, you can also say skip.", "Kya aap email dena chahenge? Yeh zaroori nahi, aap skip bhi keh sakte hain.");
    default:
      return "";
  }
}

// --- Read-back ------------------------------------------------------------------------------------------

function readBack(state: BookingState, deps: DialogDeps, lang: VoiceLang): { text: string; spoken: string } {
  const d = state.draft;
  const doc = doctorOf(deps.pack, d.doctorSlug);
  const dept = deps.pack.departments.find((x) => x.slug === (doc?.departmentSlug ?? d.departmentSlug))?.name ?? "";
  const when = `${speakDate(d.date as string)} ${T(lang, "at", "")} ${speakTime(d.time as string)}`.replace(/\s+/g, " ");
  const fee = doc ? formatPkr(doc.feePkr) : "";
  const test = labItem(deps.pack, d.labTestSlug) ?? undefined;
  const phone = d.phone as string;
  const rules = T(lang, "Confirming means you accept the clinic's booking rules, which are on our website.", "Confirm karne ka matlab hai ke aap clinic ke booking rules maante hain, jo hamari website par hain.");
  const head = T(lang, "Please check these details.", "Barah-e-meherbani yeh tafseelat check karein.");
  const lines = (spokenPhone: boolean, spokenEmail: boolean) =>
    [
      T(lang, `Name: ${d.fullName}.`, `Naam: ${d.fullName}.`),
      T(lang, `Phone: ${spokenPhone ? speakPhone(phone) : groupPhone(phone)}.`, `Phone: ${spokenPhone ? speakPhone(phone) : groupPhone(phone)}.`),
      T(lang, `Doctor: ${doc?.name ?? ""}${dept ? `, ${dept}` : ""}.`, `Doctor: ${doc?.name ?? ""}${dept ? `, ${dept}` : ""}.`),
      T(lang, `When: ${when}.`, `Kab: ${when}.`),
      d.reason && !test ? T(lang, `Reason: ${d.reason}.`, `Wajah: ${d.reason}.`) : "",
      d.email ? T(lang, `Email: ${spokenEmail ? speakEmail(d.email) : d.email}.`, `Email: ${spokenEmail ? speakEmail(d.email) : d.email}.`) : "",
      test ? T(lang, `${test.kind === "package" ? "Package" : "Test"}: ${test.name}, ${formatPkr(test.pricePkr)}.`, `${test.kind === "package" ? "Package" : "Test"}: ${test.name}, ${formatPkr(test.pricePkr)}.`) : fee ? T(lang, `Fee: ${fee}.`, `Fee: ${fee}.`) : "",
    ]
      .filter(Boolean)
      .join(" ");
  // The chat shows the filled card and one short line; the details are also read aloud (phone digit by digit).
  const doing = T(lang, "Thank you! I'm making your booking now.", "Shukriya! Ji, main aap ki booking kar rahi hoon.");
  const ask = confirmLine(lang);
  return { text: `${doing} ${ask}`, spoken: `${doing} ${head} ${lines(true, true)} ${rules} ${ask}` };
}

/** The line that asks the patient to check the card and confirm (by voice or by tapping Confirm). */
export const confirmLine = (lang: VoiceLang): string =>
  T(lang, "Please check the card, then say yes or tap Confirm.", "Please card check karein, phir haan kahein ya Confirm dabaiye.");

// --- One turn ---------------------------------------------------------------------------------------------

function reply(state: BookingState, text: string, extra: Partial<DialogReply> = {}): DialogReply {
  return { state, text, ...extra };
}

function changeSentence(applied: Applied, state: BookingState, deps: DialogDeps, lang: VoiceLang): string {
  const corrected = applied.changes.filter((c) => c.was);
  const first1 = corrected[0];
  if (!first1) return "";
  const d = state.draft;
  switch (first1.field) {
    case "date":
      return d.date ? T(lang, `Done, ${speakDate(d.date)}.`, `Theek hai, ${speakDate(d.date)}.`) : "";
    case "doctor":
      return T(lang, `Done, ${doctorOf(deps.pack, d.doctorSlug)?.name ?? "the new doctor"}.`, `Theek hai, ${doctorOf(deps.pack, d.doctorSlug)?.name ?? "naye doctor"}.`);
    case "fullName":
      return T(lang, `Done, ${d.fullName}.`, `Theek hai, ${d.fullName}.`);
    case "phone":
      return d.phone ? T(lang, `Done, ${groupPhone(d.phone)}.`, `Theek hai, ${groupPhone(d.phone)}.`) : "";
    case "email":
      return T(lang, "Done, I've updated your email.", "Theek hai, email badal di.");
    default:
      return T(lang, "Done, updated.", "Theek hai, badal diya.");
  }
}

/** A short warm acknowledgement of something newly heard (not a correction). */
function welcomeSentence(applied: Applied, state: BookingState, deps: DialogDeps, lang: VoiceLang): string {
  const newName = applied.changes.find((c) => c.field === "fullName" && !c.was);
  if (newName && state.draft.fullName) return T(lang, `Nice to meet you, ${first(state.draft.fullName)}.`, `Aap se mil kar khushi hui, ${first(state.draft.fullName)}.`);
  const newDoctor = applied.changes.find((c) => c.field === "doctor" && !c.was);
  const doc = doctorOf(deps.pack, state.draft.doctorSlug);
  const test = labItem(deps.pack, state.draft.labTestSlug);
  const lab = test ? labDepartment(deps.pack) : null;
  if (newDoctor && doc && test && lab) return T(lang, `${test.name} at our ${lab.name}, with ${doc.name}.`, `${test.name}, hamari ${lab.name} mein, ${doc.name} ke saath.`);
  if (newDoctor && doc) return T(lang, `With ${doc.name}.`, `${doc.name} ke saath.`);
  return "";
}

/** The question the dialog is waiting on, for asking it again after a side question. */
export function currentQuestion(state: BookingState, deps: DialogDeps, lang: VoiceLang): string {
  return question(state, deps, lang, state.asking, null, []);
}

export async function bookingStep(start: BookingState, input: Input, deps: DialogDeps): Promise<DialogReply> {
  const { lang, text } = input;
  let state = start;

  if (state.phase === "booked" && state.booked) {
    return reply(state, T(lang, "Your booking is done. I can make one booking per conversation. For another, please use the booking page or call the clinic.", "Aap ki booking ho chuki hai. Main ek conversation mein ek hi booking kar sakti hoon. Doosri ke liye booking page istemal karein ya clinic ko call karein."), {
      links: [{ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" }],
    });
  }

  if (state.phase === "failed") {
    const phone = deps.pack.clinic.phone;
    return reply(state, T(lang, `I'm not able to continue this booking. Please call the clinic on ${phone}.`, `Main yeh booking aage nahi barha sakti. Barah-e-meherbani clinic ko ${phone} par call karein.`));
  }

  if (state.phase === "awaiting_yes" || state.phase === "submitting") {
    const answer = parseYesNo(text);
    if (answer === "yes") {
      if (!input.confirmable) {
        // The caller spoke while the read-back was still being read (or it could be an echo): ask again, never book.
        const again = T(lang, "Just to be sure: please say yes or tap Confirm.", "Pakka karne ke liye: haan kahein ya Confirm dabaiye.");
        return reply(state, again, { readBack: true });
      }
      return submit(state, deps, lang);
    }
    // A correction wins over a plain "no": "no, make it the 14th" changes the date and reads it back again.
    const before = JSON.stringify(state.draft);
    const applied = applyUtterance({ ...state, phase: "collecting" }, text, deps, input.script);
    if (JSON.stringify(applied.state.draft) !== before || applied.state.pendingTimes.length > 0) {
      return collect({ ...applied.state, phase: "collecting", key: null }, applied, deps, lang);
    }
    if (answer === "no") {
      state = { ...state, phase: "collecting", asking: null, key: null };
      return reply(state, T(lang, "No problem, I won't book it. What would you like to change?", "Koi baat nahi, main book nahi karungi. Aap kya badalna chahenge?"));
    }
    return reply(state, T(lang, "Please say yes or tap Confirm, or tell me what to change.", "Haan kahein ya Confirm dabaiye, ya bata dein ke kya badalna hai."), { readBack: true });
  }

  const applied = applyUtterance(state, text, deps, input.script);
  return collect(applied.state, applied, deps, lang, text);
}

/** Short answers to tap (or say) for the question being asked: departments, the next open days, or free times. */
function optionsFor(state: BookingState, deps: DialogDeps, lang: VoiceLang, ask: Ask): string[] {
  const { pack } = deps;
  const d = state.draft;
  const slots = d.doctorSlug ? state.slots[d.doctorSlug] : undefined;
  if (ask === "doctor") {
    const team = d.departmentSlug ? doctorsOf(d.departmentSlug, pack) : [];
    if (team.length > 1) return team.slice(0, 4).map((x) => x.name);
    const lab = labDepartment(pack);
    const preferred = ["general-medicine", "dental", "dermatology", "pediatrics", "gynecology", "cardiology"];
    const depts = preferred.filter((slug) => pack.doctors.some((x) => x.departmentSlug === slug)).map((slug) => pack.departments.find((x) => x.slug === slug)?.name ?? "").filter(Boolean);
    const test = lab && pack.labTests.some((t) => /complete-blood-count/.test(t.slug)) ? ["Blood test (CBC)"] : [];
    return [...test, ...depts].slice(0, 4);
  }
  if (ask === "date" && slots) return openDays(slots).slice(0, 3).map(speakDate);
  if (ask === "time" && slots && d.date) {
    const day = dayOf(slots, d.date);
    return day ? spread(day.slots.map((s) => s.localTime)).map(speakTime) : [];
  }
  if (ask === "partOfDay") return [...state.pendingTimes].sort().map(speakTime);
  if (ask === "email") return ["Skip"];
  if (ask === "nameCheck") return [T(lang, "Yes, it's right", "Haan, theek hai"), T(lang, "No, it's wrong", "Nahi, galat hai")];
  return [];
}

const MISSED_HINT: Partial<Record<NonNullable<Ask>, [string, string]>> = {
  fullName: ["For example: Ali Raza.", "Misal ke taur par: Ali Raza."],
  phone: ["For example: 0300 1234567.", "Misal ke taur par: 0300 1234567."],
};

async function collect(start: BookingState, applied: Applied, deps: DialogDeps, lang: VoiceLang, text = ""): Promise<DialogReply> {
  const settled = await settle(start, deps, lang);
  let state = settled.state;
  const ask = nextAsk(state);
  // The same question again with nothing new heard is a miss. Twice (or a frustrated "why aren't you booking?"):
  // apologise and show choices instead of repeating the same sentence.
  const missed = ask !== null && ask === start.asking && start.phase === "collecting" && applied.changes.length === 0 && !applied.phoneProblem && !settled.message;
  const angry = complains(text);
  const misses = missed || angry ? Math.max(start.misses + 1, angry ? 2 : 0) : 0;
  state = { ...state, misses };
  const sorry = misses >= 2 ? (angry ? T(lang, "Sorry about that! I'm booking it for you now.", "Maaf kijiye! Main aap ki booking kar rahi hoon.") : T(lang, "Sorry, I didn't quite get that.", "Maaf kijiye, main theek se samajh nahi saki.")) : "";
  const lead = [sorry, changeSentence(applied, state, deps, lang) || welcomeSentence(applied, state, deps, lang), settled.message ?? ""].filter(Boolean).join(" ");

  if (ask === null) {
    const rb = readBack(state, deps, lang);
    state = { ...state, phase: "awaiting_yes", asking: null, key: state.key ?? deps.newKey() };
    return reply(state, [lead, rb.text].filter(Boolean).join(" "), { spoken: [lead, rb.spoken].filter(Boolean).join(" "), readBack: true });
  }
  state = { ...state, phase: "collecting", asking: ask };
  const options = optionsFor(state, deps, lang, ask);
  const field: Partial<DialogReply> = ask === "phone" ? { input: "phone" } : {};
  const hint = ask === "phone" ? "" : misses >= 2 ? (options.length ? T(lang, "You can also tap one of the choices below.", "Aap neeche diye gaye options mein se chun bhi sakte hain.") : (MISSED_HINT[ask as NonNullable<Ask>]?.[lang === "roman" ? 1 : 0] ?? "")) : "";
  return reply(state, [lead, question(state, deps, lang, ask, applied.phoneProblem, applied.ambiguousDoctors), hint].filter(Boolean).join(" "), { ...(options.length ? { options } : {}), ...field });
}

async function submit(start: BookingState, deps: DialogDeps, lang: VoiceLang): Promise<DialogReply> {
  const d = start.draft;
  const state: BookingState = { ...start, phase: "submitting" };
  const key = state.key ?? deps.newKey();
  const phone = deps.pack.clinic.phone;
  const payload: BookingPayload = {
    doctorSlug: d.doctorSlug as string,
    startsAt: d.startsAt as string,
    fullName: d.fullName as string,
    mobile: d.phone as string,
    email: d.email,
    reason: d.reason,
    acceptRules: true,
    trap: null,
  };
  let answer: BookingAnswer;
  try {
    answer = await deps.submit(payload, key);
  } catch {
    return reply({ ...state, phase: "awaiting_yes", key }, T(lang, "I couldn't confirm the booking just now. Nothing has been lost. Say yes and I'll try once more.", "Abhi booking confirm nahi ho saki. Kuch zaaya nahi hua. Haan kahein, main dobara koshish karti hoon."), { readBack: true });
  }
  const { status, body } = answer;
  if (status === 201) {
    const view = AppointmentViewSchema.safeParse(body);
    if (view.success) {
      const v = view.data;
      const done: BookingState = { ...state, phase: "booked", booked: v, asking: null };
      const when = `${speakDate(v.localDate)} ${T(lang, "at", "")} ${speakTime(v.localTime)}`.replace(/\s+/g, " ");
      const base = (ref: string) =>
        T(
          lang,
          `You're booked, ${first(d.fullName as string)}! ${v.doctor.fullName}, ${when}. Your reference is ${ref}. Tap Open my slip, download the slip, save it on your phone, and bring it with you to the clinic.`,
          `Aap ki booking ho gayi, ${first(d.fullName as string)}! ${v.doctor.fullName}, ${when}. Aap ka reference ${ref} hai. Open my slip dabaiye. Slip download karke mobile mein save karein aur clinic aate waqt saath laayein.`,
        );
      return reply(done, base(groupReference(v.reference)), { spoken: base(speakReference(v.reference)), booked: v });
    }
  }
  if (status === 409) {
    const conflict = BookingConflictSchema.safeParse(body);
    const code = conflict.success ? conflict.data.error.code : null;
    if (conflict.success && (code === "slot_taken" || code === "slot_unavailable")) {
      // Refresh the doctor's slots, forget the taken time, and offer what the server offered.
      const refreshed = await slotsFor({ ...state, key: null }, d.doctorSlug as string, deps, true);
      const alts = (conflict.data.alternatives ?? []).slice(0, 3).map((a) => `${speakDate(a.localDate)} ${speakTime(a.localTime)}`);
      const next = { ...withDraft(refreshed.state, { time: null, startsAt: null }), phase: "collecting" as const, asking: "time" as const, key: null, pendingTimes: [] };
      const offer = alts.length
        ? T(lang, `Sorry, that time was just taken. I can offer ${joinList(alts, lang)}. Which would you like?`, `Maaf kijiye, woh waqt abhi book ho gaya. Mere paas ${joinList(alts, lang)} hain. Kaun sa theek rahega?`)
        : T(lang, "Sorry, that time was just taken. Which other time suits you?", "Maaf kijiye, woh waqt abhi book ho gaya. Koi aur waqt bata dein?");
      return reply(next, offer);
    }
    const limit = code === "booking_limit_reached";
    return reply({ ...state, phase: "failed" }, limit ? T(lang, `This phone number already has the maximum number of active bookings. Please call the clinic on ${phone}.`, `Is phone number par bookings ki had poori ho chuki hai. Barah-e-meherbani clinic ko ${phone} par call karein.`) : T(lang, `I couldn't complete the booking. Please call the clinic on ${phone}.`, `Booking mukammal nahi ho saki. Barah-e-meherbani clinic ko ${phone} par call karein.`));
  }
  if (status === 429) {
    return reply({ ...state, phase: "failed" }, T(lang, `There have been a lot of booking attempts, so I have to pause. Please try again later or call the clinic on ${phone}.`, `Bookings ki koshishein bohat ho gayi hain, is liye rukna parega. Baad mein koshish karein ya clinic ko ${phone} par call karein.`));
  }
  if (status === 502 || status === 503 || status === 504) {
    return reply({ ...state, phase: "awaiting_yes", key }, T(lang, "I couldn't confirm the booking just now. Nothing has been lost. Say yes and I'll try once more.", "Abhi booking confirm nahi ho saki. Kuch zaaya nahi hua. Haan kahein, main dobara koshish karti hoon."), { readBack: true });
  }
  return reply({ ...state, phase: "failed" }, T(lang, `I couldn't complete the booking. Please check the details with the booking page, or call the clinic on ${phone}.`, `Booking mukammal nahi ho saki. Booking page par tafseelat check karein ya clinic ko ${phone} par call karein.`));
}
