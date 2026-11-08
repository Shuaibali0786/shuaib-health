// Decides what one spoken (or typed) turn means and who answers it (Feature 013).
//
// Order, always: 1) the safety guards, 2) an active booking dialog, 3) a new booking request, 4) the same
// answer engine the text chat uses (the same brain, knowledge and rules). One source of facts: the public
// knowledge pack. Nothing here can reach staff, admin or other patients' data.

import { cleanText } from "@/agent/normalize";
import type { AgentLink, AgentMode, AgentProvider, KnowledgePack } from "@/agent/types";
import type { AppointmentView } from "@/lib/booking/schemas";

import { bookingStep, currentQuestion, newBookingState, type BookingState, type DialogDeps } from "./bookingDialog";
import { mentionsLabTest } from "./entities";
import { replyLanguage, urduToLatin } from "./language";
import { parseYesNo } from "./parse/yesno";
import { DONT_KNOW, T } from "./phrases";
import { guardTurn } from "./safety";
import type { VoiceLang } from "./types";

export type RouterContext = {
  pack: KnowledgePack;
  mode: AgentMode;
  lang: VoiceLang;
  provider: AgentProvider;
  deps: DialogDeps;
  booking: BookingState | null;
  /** The assistant offered a doctor booking (after a lab-test request) and is waiting for a yes. */
  offerDoctor: boolean;
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
  offerDoctor: boolean;
  booked?: AppointmentView;
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

function engineAnswer(ctx: RouterContext, mapped: string, lang: VoiceLang): Promise<Omit<RouterResult, "booking" | "offerDoctor" | "lang">> {
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

/** Routes one turn. Never throws for ordinary input; network problems inside the booking dialog are handled there. */
export async function routeTurn(ctx: RouterContext, input: RouterInput): Promise<RouterResult> {
  const mapped = urduToLatin(input.text);
  const lang = replyLanguage(input.text, ctx.lang);
  const base = { lang, booking: ctx.booking, offerDoctor: ctx.offerDoctor };

  // 1. Safety first. It cannot be switched off by any dialog state.
  const guarded = guardTurn(mapped, ctx.pack, lang);
  if (guarded) {
    let booking = ctx.booking;
    // An emergency or crisis stops a booking in progress: nothing can be confirmed until the caller starts again.
    if (guarded.pausesBooking && booking && booking.phase !== "booked") booking = { ...booking, phase: "collecting", asking: null, key: null };
    return { ...base, booking, offerDoctor: false, intent: guarded.reply.intent, text: guarded.reply.text, links: guarded.reply.links, urgent: guarded.pausesBooking };
  }

  const patient = ctx.mode === "patient";
  const active = patient && ctx.booking && ["collecting", "awaiting_yes", "submitting", "failed"].includes(ctx.booking.phase);

  // 2. A booking in progress.
  if (active && ctx.booking) {
    const asking = ctx.booking.phase === "collecting" && ctx.booking.asking !== null;
    // A side question ("what is the fee?") is answered, then the booking question is asked again.
    if (asking && QUESTION.test(mapped.trim()) && !/\b(name|naam|number|phone|mobile)\b/i.test(mapped) && parseYesNo(mapped) === "unclear") {
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
      offerDoctor: false,
      intent: out.booked ? "booking_done" : out.readBack ? "booking_read_back" : "booking",
      text: out.text,
      spoken: out.spoken,
      links: out.links,
      booked: out.booked,
      readBack: out.readBack,
    };
  }

  // 3. A new booking request (Patient tab only).
  const accepted = patient && ctx.offerDoctor && parseYesNo(mapped) === "yes";
  if (patient && (accepted || wantsBooking(mapped))) {
    if (ctx.bookingsMade >= 1) {
      const out = await bookingStep(ctx.booking ?? newBookingState(), { text: mapped, lang, confirmable: input.confirmable }, ctx.deps);
      return { ...base, intent: "booking_limit", text: T(lang, "I can make one booking per conversation, and you've already booked. For another appointment please use the booking page or call the clinic.", "Main ek conversation mein ek hi booking kar sakti hoon, aur aap book kar chuke hain. Doosre appointment ke liye booking page istemal karein ya clinic ko call karein."), links: out.links ?? [{ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" }], offerDoctor: false };
    }
    if (!accepted && mentionsLabTest(mapped, ctx.pack)) {
      return {
        ...base,
        offerDoctor: true,
        intent: "lab_not_bookable",
        text: T(
          lang,
          `Lab tests can't be booked online yet. I can book a doctor's appointment for you, or you can call the clinic on ${ctx.pack.clinic.phone} to arrange the test. Would you like a doctor booking?`,
          `Lab tests abhi online book nahi ho sakte. Main doctor ka appointment book kar sakti hoon, ya aap test ke liye clinic ko ${ctx.pack.clinic.phone} par call karein. Kya doctor ki booking karoon?`,
        ),
        links: [{ label: T(lang, "Lab tests", "Lab tests"), href: "/lab-tests" }],
      };
    }
    const start = newBookingState();
    const out = await bookingStep(start, { text: accepted ? "" : mapped, lang, confirmable: input.confirmable }, ctx.deps);
    const opener = T(lang, "Ji zaroor, I'll book that for you. This is a demo, so please use sample details.", "Ji zaroor, main aap ke liye booking kar deti hoon. Yeh ek demo hai, is liye sample details istemal karein.");
    return {
      ...base,
      booking: out.state,
      offerDoctor: false,
      intent: out.readBack ? "booking_read_back" : "booking_start",
      text: `${opener} ${out.text}`,
      spoken: out.spoken ? `${opener} ${out.spoken}` : undefined,
      readBack: out.readBack,
    };
  }

  // 4. Everything else is the same answer engine as the text chat.
  if (ctx.mode === "patient" && DEPARTMENT_LIST.test(cleanText(mapped))) {
    const names = ctx.pack.departments.filter((d) => ctx.pack.doctors.some((doc) => doc.departmentSlug === d.slug)).map((d) => d.name);
    return {
      ...base,
      offerDoctor: false,
      intent: "departments",
      text: T(lang, `We have ${names.length} departments with doctors: ${names.join(", ")}. Which one do you need?`, `Hamare paas ${names.length} departments mein doctors hain: ${names.join(", ")}. Aap ko kaun sa chahiye?`),
      links: [{ label: T(lang, "All departments", "Tamam departments"), href: "/departments" }],
    };
  }
  const answer = await engineAnswer(ctx, mapped, lang);
  // A voice caller who asks how booking works is offered the booking right now.
  const nudge = answer.intent === "booking" && ctx.mode === "patient" ? ` ${T(lang, "I can do it for you right now. Just say: book an appointment.", "Main abhi aap ke liye kar sakti hoon. Bas kahein: appointment book karein.")}` : "";
  return { ...base, ...answer, text: `${answer.text}${nudge}`, offerDoctor: false };
}
