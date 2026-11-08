// Decides what one spoken (or typed) turn means and who answers it (Feature 013).
//
// Order, always: 1) the safety guards, 2) an active booking dialog, 3) a new booking request, 4) the same
// answer engine the text chat uses (the same brain, knowledge and rules). One source of facts: the public
// knowledge pack. Nothing here can reach staff, admin or other patients' data.

import { cleanText, detectLang } from "@/agent/normalize";
import type { AgentLink, AgentMode, AgentProvider, KnowledgePack } from "@/agent/types";
import type { AppointmentView } from "@/lib/booking/schemas";

import { departmentForSymptoms } from "@/agent/localEngine";
import { formatPkr } from "@/lib/format";

import { bookingStep, currentQuestion, newBookingState, type BookingState, type DialogDeps } from "./bookingDialog";
import { clinicNow, dayName, doctorsOf, findDepartment, findDoctors, findLabTest, findPackage, labDepartment, labItem, mentionsLabTest, mentionsPackage, openDayNames, openingOn, resolveLabTest } from "./entities";
import { hasUrduScript, replyLanguage, urduToLatin } from "./language";
import type { Brain } from "./brain";
import { findProblem, type Problem } from "./problems";
import { declines } from "./parse/name";
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
  /** The optional AI brain (VOICE_BRAIN=gemini): asked only when the rules did not understand a patient turn. */
  brain?: Brain;
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
  bookedTest?: { slug: string; name: string; pricePkr: number; kind: "test" | "package" };
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

/**
 * The receptionist is a woman: the shared text engine's Roman Urdu speaks of itself in the masculine ("sakta hoon",
 * "batata hoon"), so those few forms are said in the feminine here. English is unchanged.
 */
export function feminine(text: string): string {
  return text
    .replace(/\bka assistant hoon\b/g, "ki assistant hoon")
    .replace(/\b(bata|de|kar|dikha|dhoond|samajh|le)ta hoon\b/g, "$1ti hoon")
    .replace(/\bsakta\b/g, "sakti")
    .replace(/\bnahi deta\b/g, "nahi deti")
    .replace(/\bbata dunga\b/g, "bata doongi")
    .replace(/\bdunga\b/g, "doongi")
    .replace(/\bkarunga\b/g, "karungi");
}

/** Short answers a patient can tap when it is not clear what they need. Only departments we really have. */
export function startChoices(pack: KnowledgePack, lang: VoiceLang): string[] {
  const has = (slug: string) => pack.doctors.some((d) => d.departmentSlug === slug);
  return [
    has("general-medicine") ? T(lang, "Fever or flu", "Bukhar ya zukam") : "",
    has("dental") ? T(lang, "Teeth", "Daant") : "",
    has("dermatology") ? T(lang, "Skin or allergy", "Jild ya allergy") : "",
    labDepartment(pack) ? T(lang, "Blood test", "Blood test") : "",
  ].filter(Boolean);
}

function engineAnswer(ctx: RouterContext, mapped: string, lang: VoiceLang): Promise<Omit<RouterResult, "booking" | "offer" | "lang">> {
  return ctx.provider.answer({ mode: ctx.mode, question: mapped.slice(0, 300) }).then((answer) => {
    const short = cleanText(mapped).split(" ").length <= 3;
    // "Ok", "theek hai", "haan" with nothing open: a short acknowledgement. ("Pata nahi" / "no" is not: it is asked kindly below.)
    if ((answer.intent === "unknown" || answer.intent === "guide_unknown") && ((short && parseYesNo(mapped) === "yes") || /^(ok|okay|ji|theek hai|acha|accha|achha|thanks|thank you|shukriya)$/i.test(cleanText(mapped)))) {
      return { intent: "ack", text: T(lang, "Alright! Is there anything else I can help you with?", "Theek hai! Kuch aur madad chahiye?") };
    }
    if (answer.intent === "unknown" && ctx.mode === "patient" && !QUESTION.test(mapped.trim())) {
      // Not a question we can look up: ask kindly what they need (never "I don't know" for a problem we could not read).
      return {
        intent: "unknown",
        text: T(lang, "I'd like to help. Could you tell me what the problem is, or what you'd like to get done? You can also tap a choice below.", "Main madad karna chahti hoon. Zara bataiye, takleef kya hai ya kya karwana hai? Aap neeche se bhi chun sakte hain."),
        options: startChoices(ctx.pack, lang),
        awaiting: "problem",
      };
    }
    if (answer.intent === "unknown" || answer.intent === "guide_unknown") {
      return { intent: answer.intent, text: DONT_KNOW(ctx.pack, lang), links: [{ label: T(lang, "Contact us", "Rabta karein"), href: "/contact" }] };
    }
    return { intent: answer.intent, text: lang === "roman" ? feminine(answer.text) : answer.text, links: answer.links, suggestions: answer.suggestions };
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

function packageExplanation(ctx: RouterContext, p: KnowledgePack["packages"][number], lang: VoiceLang): string {
  const lab = labDepartment(ctx.pack);
  const price = formatPkr(p.pricePkr);
  const prep = p.preparation ? (lang === "roman" ? romanOf(ROMAN_PREP, p.preparation) : p.preparation) : "";
  return lang === "roman"
    ? [`${p.name} package ki qeemat ${price} hai.`, prep ? `Tayyari: ${prep}.` : "", lab ? `Yeh hamari ${lab.name} mein hota hai.` : "", "Kya main aap ki booking kar doon?"].filter(Boolean).join(" ")
    : [`The ${p.name} package is ${price}.`, p.whoFor ? `It's for ${p.whoFor.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}.` : "", prep ? `Preparation: ${prep}.` : "", lab ? `It's done at our ${lab.name}.` : "", "Shall I book it for you?"].filter(Boolean).join(" ");
}

/** "Full body checkup" without a name: the packages we have, with prices, as choices. */
function askPackage(ctx: RouterContext, lang: VoiceLang, base: Pick<RouterResult, "lang" | "booking" | "offer">): RouterResult {
  const list = ctx.pack.packages.slice(0, 5);
  const named = list.map((p) => `${p.name} (${formatPkr(p.pricePkr)})`).join(", ");
  return {
    ...base,
    offer: null,
    intent: "ask_package",
    awaiting: "test",
    text: T(lang, `We have ${list.length} health packages: ${named}. Which one would you like?`, `Hamare paas ${list.length} health packages hain: ${named}. Aap ko kaun sa chahiye?`),
    options: list.slice(0, 4).map((p) => p.name),
    links: [{ label: T(lang, "Health packages", "Health packages"), href: "/health-packages" }],
  };
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
    const item = labItem(ctx.pack, offer.testSlug);
    const lab = labDepartment(ctx.pack);
    const only = lab?.doctors.length === 1 ? lab.doctors[0] : undefined;
    const reason = item ? (item.kind === "package" ? `${item.name} package` : `${item.name} test`) : null;
    return { departmentSlug: lab?.slug ?? null, doctorSlug: only?.slug ?? null, reason, labTestSlug: item?.slug ?? null };
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
  const out = await bookingStep(newBookingState(prefill), { text, lang, confirmable: input.confirmable, script: hasUrduScript(input.text) }, ctx.deps);
  const opener = out.state.misses >= 2 || out.readBack ? "" : T(lang, "Of course!", "Ji zaroor!");
  const item = labItem(ctx.pack, prefill.labTestSlug ?? null);
  const lab = item ? labDepartment(ctx.pack) : null;
  const doctor = prefill.doctorSlug ? ctx.pack.doctors.find((d) => d.slug === prefill.doctorSlug)?.name : undefined;
  const doc = prefill.doctorSlug ? ctx.pack.doctors.find((d) => d.slug === prefill.doctorSlug) : undefined;
  const what =
    item && lab
      ? T(lang, `${item.name} at our ${lab.name}${doctor ? `, with ${doctor}` : ""}.`, `${item.name}, hamari ${lab.name} mein${doctor ? `, ${doctor} ke saath` : ""}.`)
      : doc && !text
        ? ""
        : doc
          ? T(lang, `${doc.departmentName}, with ${doc.name} (fee ${formatPkr(doc.feePkr)}).`, `${doc.departmentName} mein ${doc.name} ke saath (fee ${formatPkr(doc.feePkr)}).`)
          : "";
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
  const options = startChoices(ctx.pack, lang);
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

/** "Assalam o Alaikum" or "hello" at the start of a turn gets a greeting back before the answer. */
function greetingBack(raw: string, lang: VoiceLang): string {
  const clean = cleanText(urduToLatin(raw));
  if (/^(as+alam\w*|salam\w*|aoa)\b/.test(clean) || /\bassalam o alaikum\b|\bassalamu?\s?alaikum\b/.test(clean)) return "Wa alaikum assalam!";
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(clean)) return T(lang, "Hello!", "Assalam o Alaikum!");
  return "";
}

/** "Dr. Hassan Mirza (PKR 2,000) and Dr. Omar Sheikh (PKR 1,800)": the doctors of a department with their fees. */
function doctorsWithFees(ctx: RouterContext, slug: string, lang: VoiceLang): string {
  const team = doctorsOf(slug, ctx.pack).slice(0, 3);
  const parts = team.map((d) => `${d.name} (${T(lang, "fee", "fee")} ${formatPkr(d.feePkr)})`);
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} ${T(lang, "and", "aur")} ${parts.at(-1)}`;
}

/** A department for a problem (general guidance only, never a diagnosis), with its doctors and fees, offered for booking. */
function suggestDepartment(ctx: RouterContext, slug: string, lang: VoiceLang, greet = "", topic = ""): RouterResult {
  const dept = ctx.pack.departments.find((d) => d.slug === slug)?.name ?? slug;
  const docs = doctorsWithFees(ctx, slug, lang);
  // Sympathy only for pain or illness, never for a cleaning, a check-up or a pregnancy.
  const unwell = /\b(dard|pain|ache|problem|masla|bukhar|fever|khansi|cough|zukam|flu|allergy|daane|rash|kharish|khujli|itch\w*|takleef|bimar|sick|ulti|vomit\w*|dast|chakkar|dizz\w*|high|infection)\b/.test(cleanText(topic));
  const sorry = unwell ? T(lang, "I'm sorry to hear that.", "Mujhe sun kar afsos hua.") : "";
  return {
    lang,
    booking: null,
    offer: { kind: "department", departmentSlug: slug },
    intent: "suggest_department",
    text: [
      greet,
      sorry,
      T(lang, `For this, our ${dept} department is the right place${docs ? `: ${docs}` : ""}.`, `Is ke liye hamara ${dept} department sahi rahega${docs ? `: ${docs}` : ""}.`),
      T(lang, "This is guidance only, not a diagnosis.", "Yeh sirf rehnumai hai, diagnosis nahi."),
      T(lang, `Shall I book an appointment for you?`, `Kya main aap ki booking kar doon?`),
    ]
      .filter(Boolean)
      .join(" "),
    links: [{ label: dept, href: `/departments/${slug}` }],
    options: [T(lang, "Yes, book it", "Ji haan, booking karein"), T(lang, "No, thanks", "Nahi, shukriya")],
  };
}

/** Something we do not offer (eyes, bones, X-ray): said honestly, with a first check-up in General Medicine when we have it. */
function notOffered(ctx: RouterContext, problem: Extract<Problem, { kind: "not_offered" }>, lang: VoiceLang, greet = ""): RouterResult {
  const gm = problem.fallback ? ctx.pack.departments.find((d) => d.slug === problem.fallback)?.name : undefined;
  const head = T(lang, `I'm sorry, we don't offer ${problem.topic} at this clinic.`, `Maaf kijiye, hamare clinic mein ${problem.topicRoman} nahi hota.`);
  const lab = labDepartment(ctx.pack);
  if (problem.imaging) {
    return {
      lang,
      booking: null,
      offer: null,
      intent: "not_offered",
      text: [greet, head, lab ? T(lang, `Our ${lab.name} does blood and urine tests. Would you like to hear about a test?`, `Hamari ${lab.name} mein blood aur urine ke tests hote hain. Kya aap kisi test ke baare mein jaanna chahenge?`) : ""].filter(Boolean).join(" "),
      options: lab ? ["CBC (blood test)", T(lang, "Health packages", "Health packages")] : [],
    };
  }
  return {
    lang,
    booking: null,
    offer: problem.fallback ? { kind: "department", departmentSlug: problem.fallback } : null,
    intent: "not_offered",
    text: [
      greet,
      head,
      gm && problem.fallback ? T(lang, `Our ${gm} doctors can do a first check-up: ${doctorsWithFees(ctx, problem.fallback, lang)}. Shall I book that for you?`, `Hamare ${gm} ke doctors pehla check-up kar sakte hain: ${doctorsWithFees(ctx, problem.fallback, lang)}. Kya main booking kar doon?`) : "",
    ]
      .filter(Boolean)
      .join(" "),
    options: gm ? [T(lang, "Yes, book it", "Ji haan, booking karein"), T(lang, "No, thanks", "Nahi, shukriya")] : [],
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
  const item = labItem(pack, slug);
  return item ? { slug: item.slug, name: item.name, pricePkr: item.pricePkr, kind: item.kind } : undefined;
}

// "Never mind" while a booking is being collected: stop it cleanly, so the conversation never gets stuck.
const ABANDON = /^(please )?(cancel|stop|never ?mind|nevermind|forget it|leave it|chhor do|chor do|rehne do|rehne den|nahi chahiye|mat karo|band karo)( (this|it|the|my) (booking|appointment))?$/;
// The same in a longer sentence: "rehne do, abhi booking nahi karni", "cancel the booking please".
const ABANDON_IN = /\b(rehne do|rehne den|chhor do|chor do|never ?mind|nevermind|forget it|(booking|appointment) (nahi|mat) (karni|karo|karwani|chahiye)|nahi karni booking|cancel (the |this |my )?(booking|appointment)|(booking|appointment) cancel|don t book|do not book|stop the booking)\b/;

/** The patient wants to stop the booking being collected (but "skip" or "nahi" for the optional email is not that). */
function abandons(text: string, booking: BookingState): boolean {
  const clean = cleanText(text);
  if (!clean) return false;
  const emailAsk = booking.phase === "collecting" && booking.asking === "email";
  if (emailAsk && declines(clean) && !/\b(booking|appointment)\b/.test(clean)) return false;
  return ABANDON.test(clean) || (clean.split(" ").length <= 10 && ABANDON_IN.test(clean));
}

const oneBookingOnly = (lang: VoiceLang) =>
  T(
    lang,
    "I can make one booking per conversation, and you've already booked. For another appointment please use the booking page or call the clinic.",
    "Main ek conversation mein ek hi booking kar sakti hoon, aur aap book kar chuke hain. Doosre appointment ke liye booking page istemal karein ya clinic ko call karein.",
  );
const bookLink = (lang: VoiceLang) => ({ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" });

/** The AI brain's one action, turned into the same replies the rules give (slugs checked against our catalog). */
async function brainReply(ctx: RouterContext, text: string, lang: VoiceLang, base: Pick<RouterResult, "lang" | "booking" | "offer">): Promise<RouterResult | null> {
  const decision = await ctx.brain?.(text, lang).catch(() => null);
  if (!decision) return null;
  const yesNo = [T(lang, "Yes, book it", "Ji haan, booking karein"), T(lang, "No, thanks", "Nahi, shukriya")];
  switch (decision.action) {
    case "suggest_department":
      return ctx.pack.doctors.some((d) => d.departmentSlug === decision.slug) ? { ...suggestDepartment(ctx, decision.slug, lang), intent: "brain_department" } : null;
    case "offer_lab_test": {
      const t = ctx.pack.labTests.find((x) => x.slug === decision.slug);
      return t && ctx.bookingsMade === 0 ? { ...base, offer: { kind: "lab", testSlug: t.slug }, intent: "brain_lab", text: labExplanation(ctx, t, lang), links: [{ label: t.name, href: `/lab-tests/${t.slug}` }], options: yesNo } : null;
    }
    case "offer_package": {
      const p = ctx.pack.packages.find((x) => x.slug === decision.slug);
      return p && ctx.bookingsMade === 0 ? { ...base, offer: { kind: "lab", testSlug: p.slug }, intent: "brain_package", text: packageExplanation(ctx, p, lang), options: yesNo } : null;
    }
    case "clinic_answer":
      return /[؀-ۿ]|https?:/i.test(decision.text) ? null : { ...base, offer: null, intent: "brain_answer", text: decision.text.slice(0, 400) };
    case "ask_problem":
      return { ...base, ...askProblem(ctx, lang) };
    default:
      return null;
  }
}

/**
 * A yes to an OFFER ("Kya main booking kar doon?"): looser than the final booking yes, because nothing is booked by it
 * (the booking still needs the patient's own "haan" or Confirm after the filled card). "Ji", "ok", "acha", "kar do".
 */
export function acceptsOffer(text: string): boolean {
  const clean = cleanText(text);
  if (!clean || clean.split(" ").length > 6 || /\b(nahi|nahin|no|not|mat|rehne|baad|later)\b/.test(clean)) return false;
  return /^(ji|jee|ji ji|ok|okay|ok ji|acha|achha|accha|theek|thik|chalo|zaroor|sure|please|haan ji|ji please|ok please|karo|kar do|karein|ji karein|ji kar dein|book|book it|go ahead|yes please|ji zaroor)( (hai|ji|please|kar do|kar dein|karein|book karein|booking karein|zaroor))*$/.test(clean);
}

/** A new department or lab item named while a booking is being collected, as a fresh prefill; null when the topic is the same. */
function topicChange(ctx: RouterContext, booking: BookingState, mapped: string): Partial<BookingDraft> | null {
  if (!["collecting", "awaiting_yes"].includes(booking.phase)) return null;
  if (booking.asking === "fullName" || booking.asking === "email" || booking.asking === "nameCheck") return null;
  if (extractPhone(mapped, "").status === "complete" || parseYesNo(mapped) === "yes") return null;
  const d = booking.draft;
  const pkg = findPackage(mapped, ctx.pack);
  const problem = findProblem(mapped, ctx.pack);
  const talksTest = /\b(tests?|lab|report|sample|cbc|hba1c|tsh|lipid)\b/.test(cleanText(mapped));
  const test = pkg || (problem?.kind === "department" && !talksTest) ? null : resolveLabTest(mapped, ctx.pack);
  const itemSlug = pkg?.slug ?? test?.slug ?? null;
  if (itemSlug) return itemSlug === d.labTestSlug ? null : prefillFor(ctx, { kind: "lab", testSlug: itemSlug });
  const slug = (problem?.kind === "department" ? problem.slug : null) ?? findDepartment(mapped, ctx.pack, { symptoms: false });
  if (!slug || slug === d.departmentSlug) return null;
  // A doctor named in the same turn is handled by the booking itself.
  if (findDoctors(mapped, ctx.pack).length > 0) return null;
  return { ...prefillFor(ctx, { kind: "department", departmentSlug: slug }), reason: problem ? mapped.slice(0, 300) : null, labTestSlug: null };
}

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
  if (ctx.mode === "patient" && ctx.booking && ["collecting", "awaiting_yes", "failed"].includes(ctx.booking.phase) && abandons(mapped, ctx.booking)) {
    return { ...base, booking: null, offer: null, intent: "booking_abandoned", text: T(lang, "No problem, I've stopped the booking. Nothing was booked. Is there anything else I can help you with?", "Koi baat nahi, maine booking rok di hai. Kuch book nahi hua. Kya aur kisi cheez mein madad karoon?") };
  }
  // "Rehne do" to an offer simply closes it.
  if (ctx.mode === "patient" && ctx.offer && !ctx.booking && (ABANDON.test(cleanText(mapped)) || ABANDON_IN.test(cleanText(mapped)))) {
    return { ...base, offer: null, intent: "offer_declined", text: T(lang, "No problem. Is there anything else I can help you with?", "Koi baat nahi. Kya aur kisi cheez mein madad karoon?") };
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
    // A change of topic mid-way ("actually, my child has a fever", "mujhe daant ka masla hai"): the booking moves to
    // the new department and keeps the name, phone and email already given.
    const switched = topicChange(ctx, ctx.booking, mapped);
    if (switched) {
      const d = ctx.booking.draft;
      const keep: Partial<BookingDraft> = { fullName: d.fullName, phone: d.phone, email: d.email, emailAnswered: d.emailAnswered };
      const dept = ctx.pack.departments.find((x) => x.slug === switched.departmentSlug)?.name ?? "";
      const lead = switched.labTestSlug ? T(lang, "No problem, let's change that.", "Theek hai, badal deti hoon.") : T(lang, `No problem, let's book ${dept} instead.`, `Theek hai, ab ${dept} ke liye booking karti hoon.`);
      const out = await startBooking(ctx, input, lang, { ...keep, ...switched }, "", lead);
      return { ...out, text: out.text.replace(/^(Of course!|Ji zaroor!)\s*/, ""), spoken: out.spoken?.replace(/^(Of course!|Ji zaroor!)\s*/, "") };
    }
    const out = await bookingStep(ctx.booking, { text: dialogText, lang, confirmable: input.confirmable, script: hasUrduScript(input.text) }, ctx.deps);
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
    const answer = acceptsOffer(mapped) ? "yes" : parseYesNo(mapped);
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

    const greet = greetingBack(input.text, lang);
    const yesNo = [T(lang, "Yes, book it", "Ji haan, booking karein"), T(lang, "No, thanks", "Nahi, shukriya")];
    const labOffer = (t: KnowledgePack["labTests"][number]): RouterResult => ({ ...base, offer: { kind: "lab", testSlug: t.slug }, intent: "lab_offer", text: [greet, labExplanation(ctx, t, lang)].filter(Boolean).join(" "), links: [{ label: t.name, href: `/lab-tests/${t.slug}` }], options: yesNo });
    const packageOffer = (p: KnowledgePack["packages"][number]): RouterResult => ({ ...base, offer: { kind: "lab", testSlug: p.slug }, intent: "package_offer", text: [greet, packageExplanation(ctx, p, lang)].filter(Boolean).join(" "), links: [{ label: T(lang, "Health packages", "Health packages"), href: "/health-packages" }], options: yesNo });
    const pkg = findPackage(mapped, ctx.pack);
    const problem = findProblem(mapped, ctx.pack);
    const limit = (): RouterResult | null => (ctx.bookingsMade >= 1 ? { ...base, offer: null, intent: "booking_limit", text: oneBookingOnly(lang), links: [bookLink(lang)] } : null);
    const bookingWord = /\b(booking|book|appointment)\b/.test(cleanText(mapped)) && !/\b(how|kaise|process|policy|rules|kab tak)\b/.test(cleanText(mapped));
    // "blood test ki booking": a booking word with a test (or a very short turn) is a request, too.
    // "How do I book?" asks how booking works; the engine answers that.
    const howTo = /\bhow (do|can|to|does)\b|\bkaise\b|\bkaisay\b/.test(cleanText(mapped)) && !/\bcan you\b|\bplease\b|\bkar do\b|\bkaro\b/.test(cleanText(mapped));
    const bookingAsked = !howTo && (asksToBook(mapped) || wantsBooking(mapped) || (bookingWord && (resolveLabTest(mapped, ctx.pack) !== null || cleanText(mapped).split(" ").length <= 3)));

    // 3b. A short answer to "which test?" or "what is the problem?" ("blood ki", "bukhar hai").
    if (ctx.awaiting === "test" || ctx.awaiting === "problem") {
      const p = pkg ?? (ctx.awaiting === "test" ? (ctx.pack.packages.find((x) => cleanText(x.name) === cleanText(mapped)) ?? null) : null);
      if (p) return limit() ?? (bookingAsked ? startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: p.slug }), "") : packageOffer(p));
      const t = resolveLabTest(mapped, ctx.pack);
      if (t) return bookingAsked ? (limit() ?? startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: t.slug }), "")) : labOffer(t);
      if (ctx.awaiting === "problem") {
        if (problem?.kind === "department") return suggestDepartment(ctx, problem.slug, lang, greet, mapped);
        if (problem?.kind === "not_offered") return notOffered(ctx, problem, lang, greet);
        const dept = findDepartment(mapped, ctx.pack);
        if (dept) return suggestDepartment(ctx, dept, lang, greet);
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
    // "Pregnancy checkup ke liye lady doctor" is the gynaecologist, not the urine pregnancy TEST: a problem word picks a
    // lab test only when the patient talks about a test.
    const talksTest = /\b(tests?|lab|report|sample|cbc|hba1c|tsh|lipid|x ?ray)\b/.test(cleanText(mapped));
    const test = problem?.kind === "department" && !talksTest ? null : resolveLabTest(mapped, ctx.pack);
    if (bookingAsked || (complains(mapped) && /\b(booking|book|appointment)\b/.test(cleanText(mapped)))) {
      const stop = limit();
      if (stop) return stop;
      if (pkg) return startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: pkg.slug }), "");
      if (test) return startBooking(ctx, input, lang, prefillFor(ctx, { kind: "lab", testSlug: test.slug }), "");
      if (problem?.kind === "not_offered") return notOffered(ctx, problem, lang, greet);
      if (problem?.kind === "department") {
        return startBooking(ctx, input, lang, { ...prefillFor(ctx, { kind: "department", departmentSlug: problem.slug }), reason: mapped.slice(0, 300) }, mapped);
      }
      const symptoms = departmentForSymptoms(mapped, ctx.pack);
      return startBooking(ctx, input, lang, symptoms ? { reason: mapped.slice(0, 300) } : {}, mapped);
    }

    // 3f. A package or a test is wanted: say what it is and offer it, or ask which one. ("Do I need to fast for the
    // lipid profile?" is a question, not a request: the engine answers it below.)
    if (pkg) return limit() ?? packageOffer(pkg);
    if (mentionsPackage(mapped) && !problem) return askPackage(ctx, lang, base);
    const named = mentionsLabTest(mapped, ctx.pack) && (talksTest || problem?.kind !== "department") ? findLabTest(mapped, ctx.pack) : null;
    if (named && WANTS.test(cleanText(mapped)) && !QUESTION.test(mapped.trim())) return limit() ?? labOffer(named);
    if (wantsTest(mapped) && !QUESTION.test(mapped.trim())) return test ? (limit() ?? labOffer(test)) : askTest(ctx, lang);

    // 3g. A problem ("bukhar hai", "skin pe daane", "BP high rehta hai"): the right department, its doctors and fees,
    // and an offer to book. A question about a doctor's days goes to the engine (which knows them), with the offer.
    // A QUESTION ("Do you have a dentist?", "BP ke liye kaun sa doctor?", "tez bukhar hai, kya karoon?") is answered by
    // the same engine as the text chat (it knows the doctors, days and safety advice), with the booking offer added.
    // A statement of a problem ("skin pe daane hain") or a test or price question is not a department suggestion here.
    const aboutTestOrPrice = /\b(tests?|report|price|prices|qeemat|fee|fees|cost|charges|tell me|about|batao|bataiye|bata do|info|information|details)\b/.test(cleanText(mapped));
    if (problem?.kind === "department" && !QUESTION.test(mapped.trim()) && !aboutTestOrPrice && findDoctors(mapped, ctx.pack).length === 0) {
      return suggestDepartment(ctx, problem.slug, lang, greet, mapped);
    }
    if (problem?.kind === "not_offered" && !aboutTestOrPrice) return notOffered(ctx, problem, lang, greet);

    // 3h. "Mujhe ilaaj karwana hai" without a problem: ask kindly what it is.
    if (asksTreatment(mapped)) {
      const dept = findDepartment(mapped, ctx.pack);
      return dept ? suggestDepartment(ctx, dept, lang, greet) : { ...askProblem(ctx, lang), text: [greet, askProblem(ctx, lang).text].filter(Boolean).join(" ") };
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
  // The optional AI brain (VOICE_BRAIN=gemini, OFF by default): only for a patient turn the rules did not understand.
  if (ctx.mode === "patient" && answer.intent === "unknown" && ctx.brain) {
    const understood = await brainReply(ctx, mapped, lang, base);
    if (understood) return understood;
  }
  if (ctx.mode === "patient" && answer.intent === "greeting") {
    // A greeting alone: short and warm, then wait (the long product welcome is for the written chat).
    const hello = greetingBack(input.text, lang) || T(lang, "Hello!", "Assalam o Alaikum!");
    return { ...base, offer: null, intent: "greeting", text: `${hello} ${T(lang, "How can I help you today?", "Bataiye, main aap ki kya madad kar sakti hoon?")}`, options: startChoices(ctx.pack, lang), awaiting: "problem" };
  }
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

  constructor(init: { pack: KnowledgePack; mode: AgentMode; provider: AgentProvider; deps: DialogDeps; lang?: VoiceLang; brain?: Brain }) {
    this.ctx = { pack: init.pack, mode: init.mode, lang: init.lang ?? "en", provider: init.provider, deps: init.deps, booking: null, offer: null, bookingsMade: 0, awaiting: null, brain: init.brain };
  }

  /** What the assistant said, newest last (for "never the same sentence twice in a row"). */
  private said: string[] = [];
  /** An apology was already made in this conversation: never again (owner test: "Maaf kijiye" over and over). */
  private apologised = false;

  async turn(text: string, options: { confirmable: boolean }): Promise<RouterResult> {
    const out = this.polish(await routeTurn(this.ctx, { text, confirmable: options.confirmable }));
    this.ctx.booking = out.booking;
    this.ctx.offer = out.offer;
    this.ctx.lang = out.lang;
    this.ctx.awaiting = out.awaiting ?? null;
    if (out.booked) this.ctx.bookingsMade += 1;
    return out;
  }

  /** Replaces the last reply (the session re-asks after mishearing) with the same no-repeat, one-apology rules. */
  replaceLast(result: RouterResult): RouterResult {
    this.said.pop();
    return this.polish(result);
  }

  private polish(result: RouterResult): RouterResult {
    const out = polishReply(result, this.said.at(-1) ?? "", this.apologised, this.ctx.pack);
    if (out.apologised) this.apologised = true;
    this.said.push(out.result.text);
    return out.result;
  }
}

// --- No repetition, one apology ---------------------------------------------------------------------------------

const APOLOGY = /^(maaf kijiye|maafi chahti hoon|sorry|i'm sorry|i am sorry|apologies)\b/i;
// "Dr. Hassan" and "e.g." are not sentence ends.
const sentencesOf = (text: string): string[] => {
  const safe = text.replace(/\b(Dr|Mr|Mrs|Ms|St|e\.g|i\.e)\./g, "$1․").replace(/(\d)\.(\d)/g, "$1․$2");
  const parts = safe.match(/[^.!?]+[.!?]*(\s+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? (safe.trim() ? [safe.trim()] : []);
  return parts.map((s) => s.replace(/․/g, "."));
};
const norm = (s: string) => cleanText(s);

// Other ways to ask the same thing, so a question asked again never sounds like a recording.
const VARIANTS: Array<[RegExp, string[]]> = [
  [/^Kaun sa din theek rahega\?/, ["Aap kis din aana chahenge?", "Kaun sa din aap ke liye munasib hai?"]],
  [/^Which day suits you\?/, ["What day would you like to come in?", "Which day works best for you?"]],
  [/^Kaun sa waqt theek rahega\?/, ["Aap ko kaun sa waqt pasand hai?", "Kis waqt aana aasaan rahega?"]],
  [/^Which time suits you\?/, ["What time works for you?", "Which of these times would you like?"]],
  [/^Aap ka poora naam kya hai\?/, ["Apna poora naam bata dein?", "Booking kis naam par karoon?"]],
  [/^May I have your full name, please\?/, ["Could you tell me your full name?", "Which name should I put the booking under?"]],
  [/^Aap ka mobile number kya hai\?/, ["Apna mobile number bata dein, aahista aahista.", "Kis mobile number par booking karoon?"]],
  [/^What is your mobile number\?/, ["Could you tell me your mobile number, slowly?", "Which mobile number should I use?"]],
  [/^Kya aap email dena chahenge\?/, ["Email dena chahenge? Na dena ho to skip keh dein.", "Email optional hai. Dena chahenge ya skip?"]],
  [/^Would you like to add an email\?/, ["Would you like to add an email, or skip it?", "An email is optional. Add one, or say skip?"]],
  [/^Kya main aap ki booking kar doon\?/, ["Booking kar doon?", "Kya aap chahenge ke main booking kar doon?"]],
  [/^Shall I book (it|an appointment) for you\?/, ["Would you like me to book it?", "Shall I go ahead and book it?"]],
  [/^Yeh mobile number nahi lag raha\./, ["Yeh number mobile ka nahi lagta, mobile number 03 se shuru hota hai aur 11 digits ka hota hai.", "Mujhe yeh mobile number theek nahi mila."]],
  [/^That doesn't look like a mobile number\./, ["That number doesn't look like a mobile number: it should start with 03 and have 11 digits.", "I couldn't read that as a mobile number."]],
  [/^I don't know that one, and I won't guess\./, ["I don't know that, and I'd rather not guess.", "I don't know the answer to that one, sorry I can't guess."]],
  [/^Yeh mujhe nahi maloom, aur main andaza nahi lagaungi\./, ["Is ka jawab mujhe nahi maloom, aur main andaza nahi lagati.", "Yeh baat mere paas nahi hai, is liye andaza nahi lagaungi."]],
];

const PHONE_IN = /\+?\d[\d ]{7,}\d/;

// Sentences that carry the free days or times: said another way, never dropped.
const INFO_VARIANTS: Array<[RegExp, string[]]> = [
  [/^(.+) has free times on (.+)\.$/, ["The free days with $1 are $2.", "$1 is available on $2."]],
  [/^(.+) ke khali waqt (.+) ko hain\.$/, ["$1 ke paas $2 ko jagah hai.", "Khali din: $2."]],
  [/^On (.+) I have (.+)\.$/, ["The free times on $1 are $2.", "On $1, $2 are free."]],
  [/^(.+) ko mere paas (.+) hain\.$/, ["$1 ko khali waqt $2 hain.", "$1 ke liye $2 khali hain."]],
];

function varied(sentence: string, used: Set<string>): string | null {
  for (const [pattern, options] of [...VARIANTS, ...INFO_VARIANTS]) {
    if (!pattern.test(sentence)) continue;
    const pick = options.map((o) => sentence.replace(pattern, o)).find((o) => !used.has(norm(o)));
    if (pick) return pick;
  }
  // A sentence with the clinic's number is never dropped (it may be all the patient needs): said another way.
  const phone = PHONE_IN.exec(sentence)?.[0];
  if (phone) {
    const roman = detectLang(sentence) === "roman";
    const options = roman ? [`Aap clinic ko ${phone} par call kar sakte hain.`, `Clinic ka number ${phone} hai.`] : [`You can call the clinic on ${phone}.`, `The clinic's number is ${phone}.`];
    return options.find((o) => !used.has(norm(o))) ?? sentence;
  }
  return null;
}

/**
 * Owner rules (2026-11-08): never the same sentence twice in a row, and at most one apology in a conversation (after
 * that: choices to tap and a calm wait). Emergencies, the booking read-back and the booked message are never changed.
 */
export function polishReply(result: RouterResult, previous: string, apologised: boolean, pack: KnowledgePack): { result: RouterResult; apologised: boolean } {
  if (result.urgent || result.booked || result.readBack) return { result, apologised: apologised || APOLOGY.test(result.text) };
  const before = new Set(sentencesOf(previous).map(norm));
  let sorry = apologised;
  const kept: string[] = [];
  for (const sentence of sentencesOf(result.text)) {
    if (APOLOGY.test(sentence)) {
      if (sorry) continue;
      sorry = true;
    }
    if (before.has(norm(sentence))) {
      const other = varied(sentence, before);
      if (other) kept.push(other);
      continue;
    }
    kept.push(sentence);
  }
  // Only sentences said a moment ago were left: wait calmly with choices, in words not used last time.
  if (kept.length === 0 || kept.every((s) => APOLOGY.test(s))) {
    const lang = result.lang;
    const calm = [
      T(lang, "Take your time. You can tap one of the choices below, or type your answer.", "Koi jaldi nahi. Neeche diye options mein se chun lein, ya jawab likh dein."),
      T(lang, "I'm here whenever you're ready. Tap a choice below or type it.", "Main yahin hoon, jab chahein bataiye. Neeche se chun lein ya likh dein."),
    ];
    const text = calm.find((c) => !before.has(norm(c))) ?? (calm[0] as string);
    const options = result.options?.length ? result.options : startChoices(pack, lang);
    return { result: { ...result, text, spoken: undefined, options }, apologised: sorry };
  }
  const text = kept.join(" ");
  // The spoken form is rebuilt from what is shown (it only differs for read-backs, which are never changed here).
  const spoken = result.spoken && text !== result.text ? undefined : result.spoken;
  return { result: { ...result, text, spoken }, apologised: sorry };
}
