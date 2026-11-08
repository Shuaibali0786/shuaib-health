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
import { clinicNow, dayName, doctorsOf, findDepartment, findDoctors, findLabTest, labDepartment, mentionsLabTest, openDayNames, openingOn, resolveLabTest } from "./entities";
import { replyLanguage, urduToLatin } from "./language";
import { parseDate, speakTime } from "./parse/date";
import { parseTimes } from "./parse/time";
import { extractEmail } from "./parse/name";
import { extractPhone } from "./parse/phone";
import { parseYesNo } from "./parse/yesno";
import { asksOpenToday, asksToBook, asksTreatment, canonicalize, complains, wantsTest } from "./understand";
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
  /** The assistant just asked "which test?" or "what is the problem?": a short answer ("blood ki") is read in that light. */
  awaiting: Awaiting;
};

export type Awaiting = "test" | "problem" | null;

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
  /** Short answers shown as buttons under the reply (tapping one says it). */
  options?: string[];
  /** What the next short answer refers to (see RouterContext.awaiting). */
  awaiting?: Awaiting;
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
export type Offer = { kind: "lab"; testSlug: string } | { kind: "doctor"; doctorSlug: string } | { kind: "department"; departmentSlug: string } | { kind: "any" };

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
  if (offer.kind === "lab" || offer.kind === "any") return T(lang, "Shall I book it for you?", "Kya main aap ki booking kar doon?");
  if (offer.kind === "doctor") {
    const name = ctx.pack.doctors.find((d) => d.slug === offer.doctorSlug)?.name ?? "";
    return T(lang, `Shall I book an appointment with ${name}?`, `Kya main ${name} ke saath aap ki booking kar doon?`);
  }
  const dept = ctx.pack.departments.find((d) => d.slug === offer.departmentSlug)?.name ?? "";
  return T(lang, `Shall I book an appointment in ${dept}?`, `Kya main ${dept} mein aap ki booking kar doon?`);
}

function prefillFor(ctx: RouterContext, offer: Offer): Partial<BookingDraft> {
  if (offer.kind === "any") return {};
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

async function startBooking(ctx: RouterContext, input: RouterInput, lang: VoiceLang, prefill: Partial<BookingDraft>, text: string, lead = ""): Promise<RouterResult> {
  const out = await bookingStep(newBookingState(prefill), { text, lang, confirmable: input.confirmable }, ctx.deps);
  const opener = out.state.misses >= 2 ? "" : T(lang, "Sure, I'm booking that for you now, just a minute. This is a demo, so please use sample details.", "Ji, main aap ki booking kar rahi hoon, bas ek minute. Yeh demo hai, is liye sample details istemal karein.");
  const test = prefill.labTestSlug ? ctx.pack.labTests.find((t) => t.slug === prefill.labTestSlug) : undefined;
  const lab = test ? labDepartment(ctx.pack) : null;
  const doctor = prefill.doctorSlug ? ctx.pack.doctors.find((d) => d.slug === prefill.doctorSlug)?.name : undefined;
  const what = test && lab ? T(lang, `${test.name} at our ${lab.name}${doctor ? `, with ${doctor}` : ""}.`, `${test.name}, hamari ${lab.name} mein${doctor ? `, ${doctor} ke saath` : ""}.`) : "";
  const head = [opener, lead, what].filter(Boolean).join(" ");
  return {
    lang,
    booking: out.state,
    offer: null,
    intent: out.readBack ? "booking_read_back" : "booking_start",
    text: [head, out.text].filter(Boolean).join(" "),
    spoken: out.spoken ? [head, out.spoken].filter(Boolean).join(" ") : undefined,
    readBack: out.readBack,
    options: out.options,
  };
}

/** "Mujhe ilaaj karwana hai": ask kindly what the problem is, with the departments the clinic actually has. */
function askProblem(ctx: RouterContext, lang: VoiceLang): RouterResult {
  const has = (slug: string) => ctx.pack.doctors.some((d) => d.departmentSlug === slug);
  const options = [
    has("general-medicine") ? T(lang, "Fever (General Medicine)", "Bukhar (General Medicine)") : "",
    has("dental") ? T(lang, "Teeth (Dental)", "Daant (Dental)") : "",
    has("dermatology") ? T(lang, "Skin / allergy (Dermatology)", "Jild / allergy (Dermatology)") : "",
    labDepartment(ctx.pack) ? "Blood test (CBC)" : "",
  ].filter(Boolean);
  return {
    lang,
    booking: null,
    offer: null,
    awaiting: "problem",
    intent: "ask_problem",
    text: T(
      lang,
      "Of course, I'm here to help. What's the problem? For example fever, a tooth problem, skin or allergy, or a blood test. I'll suggest the right department.",
      "Ji zaroor, main madad karti hoon. Aap ko kya takleef hai? Misal ke taur par bukhar, daant ka masla, jild ya allergy, ya blood test. Main aap ko sahi department bata doongi.",
    ),
    options,
  };
}

/** "Test karwana hai" without a name: ask which test, with a few common ones from the catalog. */
function askTest(ctx: RouterContext, lang: VoiceLang): RouterResult {
  const pick = (re: RegExp) => ctx.pack.labTests.find((t) => re.test(`${t.slug} ${t.name}`));
  const cbc = pick(/complete-blood-count/i);
  const others = [pick(/glucose|sugar/i), pick(/thyroid|tsh/i), pick(/lipid/i)].filter((t): t is NonNullable<typeof t> => Boolean(t));
  const options = [cbc ? "CBC (blood test)" : "", ...others.map((t) => t.name)].filter(Boolean).slice(0, 4);
  return {
    lang,
    booking: null,
    offer: null,
    awaiting: "test",
    intent: "ask_test",
    text: T(lang, "Sure. Which test would you like? For example CBC (blood test), blood sugar, thyroid or cholesterol.", "Ji zaroor. Kaun sa test karwana hai? Misal ke taur par CBC (blood test), sugar, thyroid ya cholesterol."),
    options,
  };
}

/** A department for a problem (general guidance only, never a diagnosis), offered for booking. */
function suggestDepartment(ctx: RouterContext, slug: string, lang: VoiceLang): RouterResult {
  const dept = ctx.pack.departments.find((d) => d.slug === slug)?.name ?? slug;
  const docs = doctorsOf(slug, ctx.pack).map((d) => d.name).slice(0, 3).join(", ");
  return {
    lang,
    booking: null,
    offer: { kind: "department", departmentSlug: slug },
    intent: "suggest_department",
    text: T(
      lang,
      `For that, our ${dept} department is the right place to start${docs ? ` (${docs})` : ""}. This is general guidance, not a diagnosis. Shall I book an appointment in ${dept}?`,
      `Is ke liye hamara ${dept} department behtar rahega${docs ? ` (${docs})` : ""}. Yeh sirf aam rehnumai hai, diagnosis nahi. Kya main ${dept} mein aap ki booking kar doon?`,
    ),
    links: [{ label: dept, href: `/departments/${slug}` }],
  };
}

/** "Kya aaj clinic band hai?": today's answer from the clinic's own opening rules, in the clinic's time zone. */
function openToday(ctx: RouterContext, lang: VoiceLang): RouterResult | null {
  const now = clinicNow(ctx.pack, ctx.deps.now());
  const rule = openingOn(ctx.pack, now.day);
  if (rule === undefined) return null;
  const days = openDayNames(ctx.pack);
  const range = days.length > 1 ? T(lang, `${days[0]} to ${days.at(-1)}`, `${days[0]} se ${days.at(-1)}`) : (days[0] ?? "");
  const first = ctx.pack.clinic.openingRules[0];
  const hours = first ? T(lang, `${speakTime(first.opens)} to ${speakTime(first.closes)}`, `${speakTime(first.opens)} se ${speakTime(first.closes)} tak`) : "";
  const base = { lang, booking: null, intent: "open_today" };
  if (rule === null) {
    return {
      ...base,
      offer: ctx.bookingsMade === 0 && ctx.mode === "patient" ? { kind: "any" } : null,
      text: T(
        lang,
        `Today is ${dayName(now.day)}, and the clinic is closed today. We're open ${range}, ${hours}.${ctx.mode === "patient" ? " Shall I book an appointment for another day?" : ""}`,
        `Aaj ${dayName(now.day)} hai, aur aaj clinic band hai. Hum ${range} ${hours} khule hain.${ctx.mode === "patient" ? " Kya main kisi aur din ki booking kar doon?" : ""}`,
      ),
    };
  }
  const t = now.time;
  const text =
    t < rule.opens
      ? T(lang, `Yes, the clinic is open today. It opens at ${speakTime(rule.opens)} and closes at ${speakTime(rule.closes)}.`, `Ji, aaj clinic khula hai. ${speakTime(rule.opens)} par khulta hai aur ${speakTime(rule.closes)} par band hota hai.`)
      : t >= rule.closes
        ? T(lang, `The clinic has closed for today. Today's hours were ${speakTime(rule.opens)} to ${speakTime(rule.closes)}. We're open ${range}.`, `Aaj ke liye clinic band ho chuka hai. Aaj ${speakTime(rule.opens)} se ${speakTime(rule.closes)} tak khula tha. Hum ${range} khule hote hain.`)
        : T(lang, `Yes, the clinic is open right now, until ${speakTime(rule.closes)} today.`, `Ji, clinic abhi khula hai, aaj ${speakTime(rule.closes)} tak.`);
  return { ...base, offer: null, text };
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
  const latin = urduToLatin(input.text);
  // Names and emails are taken word for word; everything else is read with Roman Urdu spellings and typos mapped.
  const literal = ctx.booking?.phase === "collecting" && (ctx.booking.asking === "fullName" || ctx.booking.asking === "email");
  const mapped = canonicalize(latin, { fuzzy: !literal });
  const dialogText = literal ? latin : mapped;
  const lang = replyLanguage(`${input.text} ${mapped}`, ctx.lang);
  const base = { lang, booking: ctx.booking, offer: ctx.offer };

  // 0. "Never mind" while a booking is open ends it (before the guards: it says nothing and changes nothing else).
  if (ctx.mode === "patient" && ctx.booking && ["collecting", "awaiting_yes", "failed"].includes(ctx.booking.phase) && ABANDON.test(cleanText(mapped))) {
    return { ...base, booking: null, offer: null, intent: "booking_abandoned", text: T(lang, "No problem, I've stopped the booking. Is there anything else I can help you with?", "Koi baat nahi, maine booking rok di hai. Kya aur kisi cheez mein madad karoon?") };
  }

  // 1. Safety first. It cannot be switched off by any dialog state.
  // On the words as said AND as understood, so a spelling fix can never hide a safety rule.
  const guarded = guardTurn(latin, ctx.pack, lang) ?? guardTurn(mapped, ctx.pack, lang);
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
    if (asking && asksOpenToday(mapped)) {
      const today = openToday(ctx, lang);
      if (today) return { ...base, ...today, booking: ctx.booking, offer: null, text: `${today.text.replace(/ (Shall I book|Kya main kisi).*$/, "")} ${currentQuestion(ctx.booking, ctx.deps, lang)}`.trim() };
    }
    if (asking && QUESTION.test(mapped.trim()) && !/(name|naam|number|phone|mobile)/i.test(mapped) && parseYesNo(mapped) === "unclear" && !complains(mapped)) {
      const answer = await engineAnswer(ctx, mapped, lang);
      if (answer.intent !== "unknown") {
        const again = currentQuestion(ctx.booking, ctx.deps, lang);
        return { ...base, ...answer, text: `${answer.text} ${again}`.trim() };
      }
    }
    const out = await bookingStep(ctx.booking, { text: dialogText, lang, confirmable: input.confirmable }, ctx.deps);
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
      options: out.options,
    };
  }

  if (patient) {
    const answer = parseYesNo(mapped);
    // 3a. The caller accepts or declines something the assistant offered to book.
    if (ctx.offer && answer === "yes") {
      if (ctx.bookingsMade >= 1) return { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] };
      return startBooking(ctx, input, lang, prefillFor(ctx, ctx.offer), "");
    }
    // A day or a time right after an offer ("Monday 9 November", "11:30") is a yes with the first answer in it.
    if (ctx.offer && answer === "unclear" && (parseDate(mapped, ctx.deps.now(), true) || parseTimes(mapped, true).length)) {
      if (ctx.bookingsMade >= 1) return { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] };
      return startBooking(ctx, input, lang, prefillFor(ctx, ctx.offer), dialogText);
    }
    if (ctx.offer && answer === "no") {
      return { ...base, offer: null, intent: "offer_declined", text: T(lang, "No problem. Is there anything else I can help you with?", "Koi baat nahi. Kya aur kisi cheez mein madad karoon?") };
    }

    const labOffer = (t: KnowledgePack["labTests"][number]): RouterResult => ({ ...base, offer: { kind: "lab", testSlug: t.slug }, intent: "lab_offer", text: labExplanation(ctx, t, lang), links: [{ label: t.name, href: `/lab-tests/${t.slug}` }] });
    const limit = (): RouterResult | null => (ctx.bookingsMade >= 1 ? { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] } : null);
    const bookingWord = /\b(booking|book|appointment)\b/.test(cleanText(mapped)) && !/\b(how|kaise|process|policy|rules|kab tak)\b/.test(cleanText(mapped));
    // "blood test ki booking": a booking word with a test (or a very short turn) is a request, too.
    // "How do I book?" asks how booking works; the engine answers that.
    const howTo = /\bhow (do|can|to|does)\b|\bkaise\b|\bkaisay\b/.test(cleanText(mapped)) && !/\bcan you\b|\bplease\b|\bkar do\b|\bkaro\b/.test(cleanText(mapped));
    const bookingAsked = !howTo && (asksToBook(mapped) || wantsBooking(mapped) || (bookingWord && (resolveLabTest(mapped, ctx.pack) !== null || cleanText(mapped).split(" ").length <= 3)));

    // 3b. A short answer to "which test?" or "what is the problem?" ("blood ki", "bukhar hai").
    if (ctx.awaiting === "test" || ctx.awaiting === "problem") {
      const t = resolveLabTest(mapped, ctx.pack);
      if (t) return bookingAsked ? (limit() ?? startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: t.slug }), "")) : labOffer(t);
      if (ctx.awaiting === "problem") {
        const dept = findDepartment(mapped, ctx.pack);
        if (dept) return suggestDepartment(ctx, dept, lang);
      }
    }

    // 3c. Details given before any booking ("Mera phone number 0324 5211332 aur email share@gmail.com hai"): start one
    // and keep them, instead of answering with the clinic's own contact details.
    if (extractPhone(dialogText, "").status === "complete" || extractEmail(dialogText)) {
      return limit() ?? startBooking(ctx, input, lang, ctx.offer ? prefillFor(ctx, ctx.offer) : {}, dialogText, T(lang, "Thank you, I've noted your details.", "Shukriya, maine aap ki tafseelat note kar li hain."));
    }

    // 3d. "Kya aaj clinic band hai?"
    if (asksOpenToday(mapped)) {
      const today = openToday(ctx, lang);
      if (today) return today;
    }

    // 3e. A booking request. A test named with it ("booking karo blood test ki") books the lab straight away.
    const test = resolveLabTest(mapped, ctx.pack);
    if (bookingAsked || (complains(mapped) && /\b(booking|book|appointment)\b/.test(cleanText(mapped)))) {
      const stop = limit();
      if (stop) return stop;
      if (test) return startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: test.slug }), "");
      const symptoms = departmentForSymptoms(mapped, ctx.pack);
      return startBooking(ctx, input, lang, symptoms ? { reason: mapped.slice(0, 300) } : {}, mapped);
    }

    // 3f. A test is wanted: say what it is and offer it, or ask which one. ("Do I need to fast for the lipid profile?"
    // is a question, not a request: the engine answers it below.)
    const named = mentionsLabTest(mapped, ctx.pack) ? findLabTest(mapped, ctx.pack) : null;
    if (named && WANTS.test(cleanText(mapped)) && !QUESTION.test(mapped.trim())) return limit() ?? labOffer(named);
    if (wantsTest(mapped) && !QUESTION.test(mapped.trim())) return test ? (limit() ?? labOffer(test)) : askTest(ctx, lang);

    // 3g. "Mujhe ilaaj karwana hai": a problem in the same sentence gets a department, otherwise ask what it is.
    if (asksTreatment(mapped)) {
      const dept = findDepartment(mapped, ctx.pack);
      return dept ? suggestDepartment(ctx, dept, lang) : askProblem(ctx, lang);
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
    this.ctx = { pack: init.pack, mode: init.mode, lang: init.lang ?? "en", provider: init.provider, deps: init.deps, booking: null, offer: null, bookingsMade: 0, awaiting: null };
  }

  async turn(text: string, options: { confirmable: boolean }): Promise<RouterResult> {
    const out = await routeTurn(this.ctx, { text, confirmable: options.confirmable });
    this.ctx.booking = out.booking;
    this.ctx.offer = out.offer;
    this.ctx.lang = out.lang;
    this.ctx.awaiting = out.awaiting ?? null;
    if (out.booked) this.ctx.bookingsMade += 1;
    return out;
  }
}
