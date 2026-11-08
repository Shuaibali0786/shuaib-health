// Decides what one spoken (or typed) turn means and who answers it (Feature 013).
//
// Order, always: 1) the safety guards, 2) an active booking dialog, 3) a new booking request, 4) the same
// answer engine the text chat uses (the same brain, knowledge and rules). One source of facts: the public
// knowledge pack. Nothing here can reach staff, admin or other patients' data.

import { cleanText } from "@/agent/normalize";
import type { AgentLink, AgentMode, AgentProvider, KnowledgePack } from "@/agent/types";
import type { AppointmentView } from "@/lib/booking/schemas";

import { departmentForSymptoms } from "@/agent/localEngine";
import { formatPkr } from "@/lib/format";

import { bookingStep, currentQuestion, newBookingState, type BookingState, type DialogDeps } from "./bookingDialog";
import { doctorsOf, findDepartment, findDoctors, findLabTest, labDepartment, mentionsLabTest } from "./entities";
import { replyLanguage, urduToLatin } from "./language";
import { parseYesNo } from "./parse/yesno";
import { DONT_KNOW, T } from "./phrases";
import { guardTurn } from "./safety";
import type { BookingDraft, VoiceLang } from "./types";

export type RouterContext = {
  pack: KnowledgePack;
  mode: AgentMode;
  lang: VoiceLang;
  provider: AgentProvider;
  deps: DialogDeps;
  booking: BookingState | null;
  /** Something the assistant offered to book (a lab test, a doctor, a department), waiting for a yes. */
  offer: Offer | null;
  /** Bookings already made in this conversation (the limit is one). */
  bookingsMade: number;
};

export type RouterInput = { text: string; /** The turn did not overlap the assistant's own speech. */ confirmable: boolean };

export type RouterResult = {
  lang: VoiceLang;
  intent: string;
  text: string;
  spoken?: string;
  links?: AgentLink[];
  suggestions?: string[];
  booking: BookingState | null;
  offer: Offer | null;
  booked?: AppointmentView;
  /** For a lab booking: the test (and its public price) that the booked card and the slip show. */
  bookedTest?: { slug: string; name: string; pricePkr: number };
  /** The reply is a booking read-back (or a re-ask): the session arms the "yes" after it is spoken. */
  readBack?: boolean;
  /** An emergency: the session stops everything and speaks this first. */
  urgent?: boolean;
};

const BOOK_WORDS = /\b(book|booking|appointment|appoint|reserve|reservation|slot|apointment|appointmnt)\b/;
const WANTS = /\b(want|need|like|would like|wanna|chahiye|chahta|chahti|chahte|karna|karni|karwana|karwani|kar do|kar dein|kardo|karein|please|can you|could you|help me|let s|lets)\b/;
const SEE_DOCTOR = /\b(see|meet|visit|consult)\b.*\b(doctor|dr)\b|\b(doctor|dr)\b.*\b(milna|dikhana|dikhani|dikhwana|ke paas|se milna|ko dikhana|check ?up)\b|\bmilna\b.*\bdoctor\b|\bdoctor\b.*\bmilna\b|\bcheck ?up\b/;
const INFO_QUESTION = /\b(how|kaise|kaisay|process|steps|procedure|kya hota|what is|what s|kitna time|how long|how much|price|fee|fees|qeemat|charges|timing|timings|hours|policy|rules)\b/;

/** Does this turn ask to make a (doctor) booking, as opposed to asking how booking works? */
export function wantsBooking(text: string): boolean {
  const clean = cleanText(text);
  if (!clean) return false;
  if (BOOK_WORDS.test(clean)) {
    if (/\bhow (do|can|to)\b|\bkaise\b|\bkaisay\b/.test(clean) && !/\bcan you\b|\bplease\b/.test(clean)) return false;
    if (INFO_QUESTION.test(clean) && !WANTS.test(clean) && !/^book\b/.test(clean)) return false;
    return WANTS.test(clean) || /^(book|appointment|booking)\b/.test(clean) || /\bbook (me|my|an?|the|it|one)\b/.test(clean) || /\bappointment (with|for|at|chahiye)\b/.test(clean);
  }
  return SEE_DOCTOR.test(clean) && !INFO_QUESTION.test(clean);
}

// "Which departments do you have?" is asked often by voice; the text engine does not list them, so the voice layer does.
const DEPARTMENT_LIST = /\b(departments?|specialt(?:y|ies)|specialit(?:y|ies)|vibhag)\b.*\b(have|hain|available|offer|list|kaun|konse|kon se|which|what)\b|\b(which|what|kaun|konse|kon se|list)\b.*\b(departments?|specialt(?:y|ies)|specialit(?:y|ies))\b/;

const QUESTION = /^(what|how|when|where|which|who|why|is|are|do|does|can|kya|kab|kitni|kitna|kitne|kahan|kaun|kaise|kaisay|kyun)\b|\?\s*$/i;

function engineAnswer(ctx: RouterContext, mapped: string, lang: VoiceLang): Promise<Omit<RouterResult, "booking" | "offer" | "lang">> {
  return ctx.provider.answer({ mode: ctx.mode, question: mapped.slice(0, 300) }).then((answer) => {
    if ((answer.intent === "unknown" || answer.intent === "guide_unknown") && (parseYesNo(mapped) !== "unclear" || /^(ok|okay|ji|hmm|theek hai|acha|accha|achha|thanks|thank you|shukriya)$/i.test(cleanText(mapped)))) {
      return { intent: "ack", text: T(lang, "Alright! Is there anything else I can help you with?", "Theek hai! Kuch aur madad chahiye?") };
    }
    if (answer.intent === "unknown" || answer.intent === "guide_unknown") {
      return { intent: answer.intent, text: DONT_KNOW(ctx.pack, lang), links: [{ label: T(lang, "Contact us", "Rabta karein"), href: "/contact" }] };
    }
    return { intent: answer.intent, text: answer.text, links: answer.links, suggestions: answer.suggestions };
  });
}

/** Something the assistant offered to book, waiting for the caller's yes. */
export type Offer = { kind: "lab"; testSlug: string } | { kind: "doctor"; doctorSlug: string } | { kind: "department"; departmentSlug: string };

// The catalog's lab wording is English; for a Roman Urdu reply the common phrases are said in Roman Urdu, so one
// reply never mixes the two languages. Anything not listed is kept as it is.
const ROMAN_PREP: Record<string, string> = {
  "no preparation needed": "Koi tayyari zaroori nahi",
  "8 hours fasting; plain water is allowed": "8 ghante ka faqa; saada paani pi sakte hain",
  "8–10 hours fasting; plain water is allowed": "8–10 ghante ka faqa; saada paani pi sakte hain",
  "10–12 hours fasting; plain water is allowed": "10–12 ghante ka faqa; saada paani pi sakte hain",
  "morning sample preferred; ask the lab for timing": "Subah ka sample behtar hai; waqt lab se pooch lein",
  "first-morning urine sample preferred": "Subah ka pehla peshab ka sample behtar hai",
};
const ROMAN_SAMPLE: Record<string, string> = { blood: "khoon", urine: "peshab", "blood (fasting)": "khoon (faqe ke saath)" };
const ROMAN_REPORT: Record<string, string> = {
  "same day": "usi din",
  "24 hours": "24 ghante mein",
  "24–48 hours": "24–48 ghante mein",
  "within 2 hours": "2 ghante ke andar",
  "within 1 hour": "1 ghante ke andar",
  "2–3 working days": "2–3 kaam ke dinon mein",
};
const romanOf = (map: Record<string, string>, value: string) => map[value.trim().toLowerCase()] ?? value;

function labExplanation(ctx: RouterContext, test: KnowledgePack["labTests"][number], lang: VoiceLang): string {
  const lab = labDepartment(ctx.pack);
  const doctor = lab?.doctors.length === 1 ? lab.doctors[0] : undefined;
  // Other names, but not ones already in the test's name ("CBC" in "Complete Blood Count (CBC)").
  const aka = test.aka.filter((a) => a && !test.name.toLowerCase().includes(a.toLowerCase())).slice(0, 2);
  const price = formatPkr(test.pricePkr);
  if (lang === "roman") {
    return [
      `${test.name}${aka.length ? ` (${aka.join(", ")})` : ""} ${romanOf(ROMAN_SAMPLE, test.sampleType)} ka test hai.`,
      test.preparation ? `Tayyari: ${romanOf(ROMAN_PREP, test.preparation)}.` : "",
      test.reportTime ? `Report ${romanOf(ROMAN_REPORT, test.reportTime)} milti hai.` : "",
      `Qeemat ${price} hai (sample qeemat).`,
      lab ? `Yeh hamari ${lab.name} mein hota hai${doctor ? `, ${doctor.name} ke saath` : ""}.` : "",
      "Kya main aap ki booking kar doon?",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    `${test.name}${aka.length ? ` (also called ${aka.join(", ")})` : ""} is a ${test.sampleType.toLowerCase()} test.`,
    test.preparation ? `Preparation: ${test.preparation}.` : "",
    test.reportTime ? `Report: ${test.reportTime}.` : "",
    `Price: ${price} (sample price).`,
    lab ? `It's done at our ${lab.name}${doctor ? ` with ${doctor.name}` : ""}.` : "",
    "Shall I book it for you?",
  ]
    .filter(Boolean)
    .join(" ");
}

function offerQuestion(ctx: RouterContext, offer: Offer, lang: VoiceLang): string {
  if (offer.kind === "lab") return T(lang, "Shall I book it for you?", "Kya main aap ki booking kar doon?");
  if (offer.kind === "doctor") {
    const name = ctx.pack.doctors.find((d) => d.slug === offer.doctorSlug)?.name ?? "";
    return T(lang, `Shall I book an appointment with ${name}?`, `Kya main ${name} ke saath aap ki booking kar doon?`);
  }
  const dept = ctx.pack.departments.find((d) => d.slug === offer.departmentSlug)?.name ?? "";
  return T(lang, `Shall I book an appointment in ${dept}?`, `Kya main ${dept} mein aap ki booking kar doon?`);
}

function prefillFor(ctx: RouterContext, offer: Offer): Partial<BookingDraft> {
  if (offer.kind === "lab") {
    const test = ctx.pack.labTests.find((t) => t.slug === offer.testSlug);
    const lab = labDepartment(ctx.pack);
    const only = lab?.doctors.length === 1 ? lab.doctors[0] : undefined;
    return { departmentSlug: lab?.slug ?? null, doctorSlug: only?.slug ?? null, reason: test ? `${test.name} test` : null, labTestSlug: test?.slug ?? null };
  }
  if (offer.kind === "doctor") {
    const doctor = ctx.pack.doctors.find((d) => d.slug === offer.doctorSlug);
    return { doctorSlug: offer.doctorSlug, departmentSlug: doctor?.departmentSlug ?? null };
  }
  const team = doctorsOf(offer.departmentSlug, ctx.pack);
  return { departmentSlug: offer.departmentSlug, doctorSlug: team.length === 1 ? (team[0]?.slug ?? null) : null };
}

/** An offer that fits the engine's answer (a doctor, a department or a lab test was talked about), or null. */
function offerFor(ctx: RouterContext, intent: string, mapped: string): Offer | null {
  if (intent === "lab_test") {
    const test = findLabTest(mapped, ctx.pack);
    return test ? { kind: "lab", testSlug: test.slug } : null;
  }
  if (intent === "doctor") {
    const doctors = findDoctors(mapped, ctx.pack);
    return doctors.length === 1 && doctors[0] ? { kind: "doctor", doctorSlug: doctors[0].slug } : null;
  }
  if (intent === "department" || intent === "symptom") {
    const slug = findDepartment(mapped, ctx.pack);
    return slug ? { kind: "department", departmentSlug: slug } : null;
  }
  return null;
}

async function startBooking(ctx: RouterContext, input: RouterInput, lang: VoiceLang, prefill: Partial<BookingDraft>, text: string): Promise<RouterResult> {
  const out = await bookingStep(newBookingState(prefill), { text, lang, confirmable: input.confirmable }, ctx.deps);
  const opener = T(lang, "Of course, I'll book that for you. This is a demo, so please use sample details.", "Ji zaroor, main aap ke liye booking kar deti hoon. Yeh ek demo hai, is liye sample details istemal karein.");
  return {
    lang,
    booking: out.state,
    offer: null,
    intent: out.readBack ? "booking_read_back" : "booking_start",
    text: `${opener} ${out.text}`,
    spoken: out.spoken ? `${opener} ${out.spoken}` : undefined,
    readBack: out.readBack,
  };
}

function testOf(pack: KnowledgePack, slug: string | null): RouterResult["bookedTest"] {
  const test = slug ? pack.labTests.find((t) => t.slug === slug) : undefined;
  return test ? { slug: test.slug, name: test.name, pricePkr: test.pricePkr } : undefined;
}

// "Never mind" while a booking is being collected: stop it cleanly, so the conversation never gets stuck.
const ABANDON = /^(please )?(cancel|stop|never ?mind|forget it|leave it|chhor do|chor do|rehne do|rehne den|nahi chahiye|mat karo|band karo)( (this|it|the|my) (booking|appointment))?$/;

const oneBookingOnly = (lang: VoiceLang) =>
  T(
    lang,
    "I can make one booking per conversation, and you've already booked. For another appointment please use the booking page or call the clinic.",
    "Main ek conversation mein ek hi booking kar sakti hoon, aur aap book kar chuke hain. Doosre appointment ke liye booking page istemal karein ya clinic ko call karein.",
  );
const bookLink = (lang: VoiceLang) => ({ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" });

/** Routes one turn. Never throws for ordinary input; network problems inside the booking dialog are handled there. */
export async function routeTurn(ctx: RouterContext, input: RouterInput): Promise<RouterResult> {
  const mapped = urduToLatin(input.text);
  const lang = replyLanguage(input.text, ctx.lang);
  const base = { lang, booking: ctx.booking, offer: ctx.offer };

  // 0. "Never mind" while a booking is open ends it (before the guards: it says nothing and changes nothing else).
  if (ctx.mode === "patient" && ctx.booking && ["collecting", "awaiting_yes", "failed"].includes(ctx.booking.phase) && ABANDON.test(cleanText(mapped))) {
    return { ...base, booking: null, offer: null, intent: "booking_abandoned", text: T(lang, "No problem, I've stopped the booking. Is there anything else I can help you with?", "Koi baat nahi, maine booking rok di hai. Kya aur kisi cheez mein madad karoon?") };
  }

  // 1. Safety first. It cannot be switched off by any dialog state.
  const guarded = guardTurn(mapped, ctx.pack, lang);
  if (guarded) {
    let booking = ctx.booking;
    // An emergency or crisis stops a booking in progress: nothing can be confirmed until the caller starts again.
    if (guarded.pausesBooking && booking && booking.phase !== "booked") booking = { ...booking, phase: "collecting", asking: null, key: null };
    return { ...base, booking, offer: null, intent: guarded.reply.intent, text: guarded.reply.text, links: guarded.reply.links, urgent: guarded.pausesBooking };
  }

  const patient = ctx.mode === "patient";
  const active = patient && ctx.booking && ["collecting", "awaiting_yes", "submitting", "failed"].includes(ctx.booking.phase);

  // 2. A booking in progress.
  if (active && ctx.booking) {
    const asking = ctx.booking.phase === "collecting" && ctx.booking.asking !== null;
    // A side question ("what is the fee?") is answered, then the booking question is asked again.
    if (asking && QUESTION.test(mapped.trim()) && !/(name|naam|number|phone|mobile)/i.test(mapped) && parseYesNo(mapped) === "unclear") {
      const answer = await engineAnswer(ctx, mapped, lang);
      if (answer.intent !== "unknown") {
        const again = currentQuestion(ctx.booking, ctx.deps, lang);
        return { ...base, ...answer, text: `${answer.text} ${again}`.trim() };
      }
    }
    const out = await bookingStep(ctx.booking, { text: mapped, lang, confirmable: input.confirmable }, ctx.deps);
    return {
      ...base,
      booking: out.state,
      offer: null,
      intent: out.booked ? "booking_done" : out.readBack ? "booking_read_back" : "booking",
      text: out.text,
      spoken: out.spoken,
      links: out.links,
      booked: out.booked,
      bookedTest: out.booked ? testOf(ctx.pack, out.state.draft.labTestSlug) : undefined,
      readBack: out.readBack,
    };
  }

  if (patient) {
    const answer = parseYesNo(mapped);
    // 3a. The caller accepts or declines something the assistant offered to book.
    if (ctx.offer && answer === "yes") {
      if (ctx.bookingsMade >= 1) return { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] };
      return startBooking(ctx, input, lang, prefillFor(ctx, ctx.offer), "");
    }
    if (ctx.offer && answer === "no") {
      return { ...base, offer: null, intent: "offer_declined", text: T(lang, "No problem. Is there anything else I can help you with?", "Koi baat nahi. Kya aur kisi cheez mein madad karoon?") };
    }

    // 3b. A new booking request (or "I want a CBC test").
    const test = mentionsLabTest(mapped, ctx.pack) ? findLabTest(mapped, ctx.pack) : null;
    // ("Do I need to fast for the lipid profile?" is a question, not a request: the engine answers it below.)
    if (wantsBooking(mapped) || (test && WANTS.test(cleanText(mapped)) && !QUESTION.test(mapped.trim()))) {
      if (ctx.bookingsMade >= 1) return { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] };
      // A lab test: say what it is (from the catalog) and offer to book it, before asking anything.
      if (test) return { ...base, offer: { kind: "lab", testSlug: test.slug }, intent: "lab_offer", text: labExplanation(ctx, test, lang), links: [{ label: test.name, href: `/lab-tests/${test.slug}` }] };
      const symptoms = departmentForSymptoms(mapped, ctx.pack);
      return startBooking(ctx, input, lang, symptoms ? { reason: mapped.slice(0, 300) } : {}, mapped);
    }
  }

  // 4. Everything else is the same answer engine as the text chat.
  if (ctx.mode === "patient" && DEPARTMENT_LIST.test(cleanText(mapped))) {
    const names = ctx.pack.departments.filter((d) => ctx.pack.doctors.some((doc) => doc.departmentSlug === d.slug)).map((d) => d.name);
    return {
      ...base,
      offer: null,
      intent: "departments",
      text: T(lang, `We have ${names.length} departments with doctors: ${names.join(", ")}. Which one do you need?`, `Hamare paas ${names.length} departments mein doctors hain: ${names.join(", ")}. Aap ko kaun sa chahiye?`),
      links: [{ label: T(lang, "All departments", "Tamam departments"), href: "/departments" }],
    };
  }
  const answer = await engineAnswer(ctx, mapped, lang);
  // After an answer about a doctor, a department or a test, offer to book it (one booking per conversation).
  const offer = ctx.mode === "patient" && ctx.bookingsMade === 0 ? offerFor(ctx, answer.intent, mapped) : null;
  const nudge = offer
    ? ` ${offerQuestion(ctx, offer, lang)}`
    : answer.intent === "booking" && ctx.mode === "patient"
      ? ` ${T(lang, "I can do it for you right now. Just say: book an appointment.", "Main abhi aap ke liye kar sakti hoon. Bas kahein: appointment book karein.")}`
      : "";
  return { ...base, ...answer, text: `${answer.text}${nudge}`, offer };
}

/**
 * One conversation's memory, shared by the typed chat and voice mode (FR-003, FR-020): the booking being collected,
 * an open offer, the language, and how many bookings were made. It lives in memory only and is gone with the chat.
 */
export class Conversation {
  readonly ctx: RouterContext;

  constructor(init: { pack: KnowledgePack; mode: AgentMode; provider: AgentProvider; deps: DialogDeps; lang?: VoiceLang }) {
    this.ctx = { pack: init.pack, mode: init.mode, lang: init.lang ?? "en", provider: init.provider, deps: init.deps, booking: null, offer: null, bookingsMade: 0 };
  }

  async turn(text: string, options: { confirmable: boolean }): Promise<RouterResult> {
    const out = await routeTurn(this.ctx, { text, confirmable: options.confirmable });
    this.ctx.booking = out.booking;
    this.ctx.offer = out.offer;
    this.ctx.lang = out.lang;
    if (out.booked) this.ctx.bookingsMade += 1;
    return out;
  }
}
