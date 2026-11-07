// The free, built-in answer engine (Feature 010, ADR-0013; v1.1). Deterministic: it finds what the question
// is about (greetings and small talk, intent words, the best-matching doctor, department, lab test, package
// or FAQ, or a symptom's department) and answers ONLY from the knowledge pack, in the person's own style
// (English or simple Roman Urdu). It never diagnoses, never invents, and never opens with "Sorry".

import { MAX_QUESTION, cleanText, detectLang, nameTokens, rawWords, tokens, type Lang } from "./normalize";
import { GUIDE_SUGGESTIONS, GUIDE_TOPICS } from "./productGuide";
import type { AgentProvider, AgentReply, AgentRequest, KnowledgePack } from "./types";

/** The four quick replies shown with the welcome, small talk and the fallback. */
export const QUICK_REPLIES: Record<Lang, string[]> = {
  en: ["Book appointment", "Find a doctor", "Lab tests and fees", "Timings and location"],
  roman: ["Appointment book karein", "Doctor dhoondein", "Lab tests aur fees", "Timings aur location"],
};
/** Kept for the widget's first screen (v1 name). */
export const PATIENT_SUGGESTIONS = QUICK_REPLIES.en;

const EMERGENCY =
  /\b(emergency|urgent|chest pain|cant breathe|can t breathe|not breathing|unconscious|bleeding|heart attack|stroke|suicid|overdose|seizure|faint|saans nahi|behosh|khoon beh|dil ka daura)/;
const SYMPTOM =
  /\b(pain|ache|fever|cough|dard|bukhar|headache|rash|vomit|vomiting|diarrh|dizzy|diagnos|medicine|medication|dose|tablet|treatment for|cure|symptom|sick|ill|infection|bp|sugar level|pregnan|itch|itching|acne|pimple|khansi|khujli|kharish|ulti|dast|zukam|chakkar|kamzori|toothache|flu|cold|allergy|periods?)\b/;

// Symptom words that point to one department (no diagnosis: only where to start). Order matters: the first
// group that matches wins, and a child (any symptom) goes to Paediatrics first.
const CHILD = /\b(child|children|kid|kids|baby|infant|bacha|bachay|bachi|bachey|bachon|beta|beti|son|daughter|toddler)\b/;
const SYMPTOM_DEPARTMENTS: Array<{ slug: string; words: RegExp }> = [
  { slug: "dental", words: /\b(tooth|teeth|toothache|daant|dant|gum|gums|cavity|jaw)\b/ },
  { slug: "dermatology", words: /\b(skin|rash|itch|itching|khujli|kharish|acne|pimples?|eczema|allergy on skin|daane)\b/ },
  { slug: "gynecology", words: /\b(pregnan\w*|period|periods|menstrual|haamla)\b/ },
  { slug: "cardiology", words: /\b(palpitations?|bp|blood pressure|heartbeat)\b/ },
];
const GENERAL = "general-medicine";
const PEDIATRICS = "pediatrics";

const pkr = (n: number) => `PKR ${n.toLocaleString("en-US")}`;
const DAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const T = (lang: Lang, en: string, roman: string) => (lang === "roman" ? roman : en);

/** Two words match when equal, or when they share a long common start ("cardiologist" / "cardiology"). */
function wordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const short = Math.min(a.length, b.length);
  if (short < 4) return false;
  let common = 0;
  while (common < short && a[common] === b[common]) common += 1;
  return common >= 5 ? common / short >= 0.7 : common === short;
}

/** How many of the question's words appear among an entity's words. */
function score(question: string[], entity: string[]): number {
  return question.reduce((sum, word) => sum + (entity.some((e) => wordMatch(word, e)) ? 1 : 0), 0);
}

function best<T>(items: readonly T[], words: string[], toWords: (item: T) => string[], min = 1): { item: T; score: number } | null {
  let top: { item: T; score: number } | null = null;
  for (const item of items) {
    const s = score(words, toWords(item));
    if (s >= min && (!top || s > top.score)) top = { item, score: s };
  }
  return top;
}

const has = (words: string[], ...wanted: string[]) => wanted.some((w) => words.includes(w));

// Topic words say what is asked (a price, a time, a booking), not which item. They never pick a doctor, test,
// package or department, so "TSH test price" is decided by "tsh", not by "test" or "price".
const GENERIC = new Set(["test", "fee", "hours", "book", "doctor", "location", "contact", "report", "when", "home", "sample", "package", "department", "health", "clinic", "check"]);

// --- Greetings and small talk -------------------------------------------------------------------------

type Social = "salam" | "greeting" | "morning" | "afternoon" | "evening" | "marhaba" | "thanks" | "bye" | "about" | "help" | "how_are_you";

// Phrases removed from the question before the rest is answered. Latin patterns run on the cleaned text,
// script patterns on the raw text (Urdu and Arabic letters do not survive cleaning).
const SOCIAL_LATIN: Array<[Social, RegExp]> = [
  ["salam", /\b(w[ae]?\s?alaikum\s?(us|as)?\s?salam|(as+)?salam+u?\s?o?\s?(a|w)?\s?alaikum|as+alam(o|u)?alaikum|salaam|salam|aoa|asalam)\b/g],
  ["morning", /\b(good morning|subah bakhair)\b/g],
  ["afternoon", /\bgood afternoon\b/g],
  ["evening", /\b(good evening|good night|sham bakhair|shab bakhair)\b/g],
  ["marhaba", /\b(marhaba|marhaban|ahlan( wa sahlan)?)\b/g],
  ["greeting", /\b(hi+|hello+|hey+|hiya|howdy|greetings|yo)\b/g],
  ["thanks", /\b(thank you so much|thank you|thanks a lot|thanks|thankyou|thx|ty|shukriya|shukria|bohat shukriya|jazakallah( khair)?|meherbani)\b/g],
  ["bye", /\b(goodbye|good bye|bye+|see you|khuda hafiz|allah hafiz|take care|ok bye)\b/g],
  ["about", /\b(who are you|what are you|what do you do|what can you do|aap kaun (ho|hain)|tum kaun ho|aap kya karte (ho|hain)|kya kar sakte ho|are you a bot|are you human|are you ai|your name)\b/g],
  ["help", /\b(help me|help|madad|need help|assist)\b/g],
  ["how_are_you", /\b(how are you|how r u|kaise ho|kaisay ho|kya haal hai|aap kaise hain|how is it going)\b/g],
];
const SOCIAL_SCRIPT: Array<[Social, RegExp]> = [
  ["salam", /(السلام\s*(علیکم|عليكم)|وعلیکم\s*السلام|وعليكم\s*السلام|سلام)/g],
  ["marhaba", /(مرحبا|اهلا|أهلا)/g],
  ["thanks", /(شکریہ|شكرا|شكراً|جزاك\s*الله)/g],
  ["bye", /(خدا\s*حافظ|اللہ\s*حافظ|مع\s*السلامة)/g],
  ["morning", /(صبح\s*بخیر|صباح\s*الخير)/g],
];
// Words that may remain after a greeting without being a question ("hi there", "salam doctor sahab").
const FILLER = new Set("there team everyone all sir madam maam dear doctor sahab ji bhai jee again friend clinic assistant bot o ho".split(" "));

function readSocial(raw: string): { kinds: Social[]; rest: string } {
  const kinds: Social[] = [];
  let script = raw;
  for (const [kind, pattern] of SOCIAL_SCRIPT) {
    if (pattern.test(script)) kinds.push(kind);
    script = script.replace(pattern, " ");
  }
  let text = cleanText(script);
  for (const [kind, pattern] of SOCIAL_LATIN) {
    if (pattern.test(text)) kinds.push(kind);
    text = text.replace(pattern, " ");
  }
  const rest = text
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ");
  return { kinds: [...new Set(kinds)], rest };
}

function opener(kinds: Social[], lang: Lang): string {
  if (kinds.includes("salam")) return "Wa alaikum assalam!";
  if (kinds.includes("marhaba")) return "Marhaba!";
  if (kinds.includes("morning")) return T(lang, "Good morning!", "Subah bakhair!");
  if (kinds.includes("afternoon")) return "Good afternoon!";
  if (kinds.includes("evening")) return T(lang, "Good evening!", "Sham bakhair!");
  return T(lang, "Hello!", "Assalam o alaikum!");
}

function welcome(pack: KnowledgePack, lang: Lang, first: string): string {
  return T(
    lang,
    `${first} Welcome to ${pack.clinic.name}. I'm the clinic's assistant. I can help you book an appointment, find the right doctor, check lab tests and fees, or share our timings and location. How can I help you today?`,
    `${first} ${pack.clinic.name} mein khush aamdeed. Main clinic ka assistant hoon. Main appointment book karne, sahi doctor dhoondne, lab tests aur fees, aur timings aur location mein madad kar sakta hoon. Bataiye, main aap ki kya madad karoon?`,
  );
}

/** The widget's first message (the same warm welcome a greeting gets). */
export function welcomeMessage(pack: KnowledgePack, lang: Lang = "en"): string {
  return welcome(pack, lang, T(lang, "Hello!", "Assalam o alaikum!"));
}

function socialReply(kinds: Social[], pack: KnowledgePack, lang: Lang): AgentReply {
  const suggestions = QUICK_REPLIES[lang];
  const name = pack.clinic.name;
  if (kinds.includes("bye")) {
    return {
      intent: "bye",
      text: T(lang, `Take care, and thank you for visiting ${name}. Goodbye!`, `Allah Hafiz! ${name} aane ka shukriya. Apna khayal rakhiye.`),
    };
  }
  if (kinds.includes("thanks")) {
    return { intent: "thanks", text: T(lang, "You're very welcome! Is there anything else I can help you with?", "Koi baat nahi! Kuch aur madad chahiye to zaroor bataiye."), suggestions };
  }
  if (kinds.includes("about") || kinds.includes("help")) {
    return {
      intent: kinds.includes("about") ? "about" : "help",
      text: T(
        lang,
        `I'm ${name}'s assistant. I answer questions about our doctors, departments, lab tests, fees, timings and location, and I can take you straight to booking. I can't give medical advice, but I can tell you which department to start with.`,
        `Main ${name} ka assistant hoon. Main doctors, departments, lab tests, fees, timings aur location ke baare mein batata hoon, aur aap ko seedha booking tak le ja sakta hoon. Main medical mashwara nahi deta, lekin bata sakta hoon ke kis department se shuru karein.`,
      ),
      suggestions,
    };
  }
  if (kinds.includes("how_are_you")) {
    return { intent: "how_are_you", text: T(lang, "I'm doing well, thank you for asking! How can I help you today?", "Main theek hoon, poochne ka shukriya! Bataiye, main kya madad karoon?"), suggestions };
  }
  return { intent: "greeting", text: welcome(pack, lang, opener(kinds, lang)), suggestions };
}

// --- Answers ------------------------------------------------------------------------------------------

function emergencyReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const { emergencyPhone, emergencyNumbers } = pack.clinic;
  return {
    intent: "emergency",
    text: T(
      lang,
      `This sounds urgent. Please call ${emergencyNumbers} now or go to the nearest emergency department. The clinic's emergency line is ${emergencyPhone}. I can't help with emergencies in chat.`,
      `Yeh emergency lag rahi hai. Fori ${emergencyNumbers} par call karein ya qareebi emergency jayein. Clinic ki emergency line ${emergencyPhone} hai. Main chat mein emergency mein madad nahi kar sakta.`,
    ),
    links: [{ label: `Call ${emergencyPhone}`, href: `tel:${emergencyPhone.replace(/[^\d+]/g, "")}` }],
  };
}

function symptomReply(clean: string, pack: KnowledgePack, lang: Lang): AgentReply {
  const departmentBySlug = (slug: string) => pack.departments.find((d) => d.slug === slug);
  const matched = SYMPTOM_DEPARTMENTS.find((group) => group.words.test(clean));
  const slug = CHILD.test(clean) || /\bpediatrics\b/.test(clean) ? PEDIATRICS : (matched?.slug ?? GENERAL);
  const dept = departmentBySlug(slug) ?? departmentBySlug(GENERAL);
  const safety = T(
    lang,
    `This is not medical advice. If it is an emergency, call ${pack.clinic.emergencyNumbers} or go to the nearest emergency department.`,
    `Yeh medical mashwara nahi hai. Emergency ho to fori ${pack.clinic.emergencyNumbers} par call karein ya qareebi emergency jayein.`,
  );
  if (!dept) {
    return {
      intent: "symptom",
      text: T(lang, `I can't give medical advice or a diagnosis. Please book a consultation so a doctor can help. ${safety}`, `Main medical mashwara ya diagnosis nahi de sakta. Doctor se consultation book kar lijiye. ${safety}`),
      links: [{ label: "Book an appointment", href: "/book-appointment" }],
    };
  }
  const team = pack.doctors.filter((d) => d.departmentSlug === dept.slug).map((d) => d.name);
  const doctors = team.length ? T(lang, ` Doctors there: ${team.join(", ")}.`, ` Wahan ke doctors: ${team.join(", ")}.`) : "";
  return {
    intent: "symptom",
    department: dept.slug,
    text: T(
      lang,
      `I can't give medical advice or a diagnosis, but our ${dept.name} department is the right place to start.${doctors} ${safety}`,
      `Main medical mashwara ya diagnosis nahi de sakta, lekin is ke liye hamara ${dept.name} department behtar rahega.${doctors} ${safety}`,
    ),
    links: [
      { label: T(lang, `Book in ${dept.name}`, `${dept.name} mein booking`), href: `/book-appointment?department=${encodeURIComponent(dept.slug)}` },
      { label: T(lang, `${dept.name} department`, `${dept.name} department`), href: `/departments/${dept.slug}` },
    ],
  };
}

function quickReply(clean: string): "book" | "doctors" | "labs" | "visit" | null {
  const text = clean.replace(/\s+/g, " ");
  if (/^(book appointment|book an appointment|appointment book karein|appointment book karni hai|booking karni hai)$/.test(text)) return "book";
  if (/^(find a doctor|doctor dhoondein|doctor chahiye|find doctor)$/.test(text)) return "doctors";
  if (/^(lab tests and fees|lab tests aur fees|tests and fees|test aur fees)$/.test(text)) return "labs";
  if (/^(timings and location|timings aur location|timing aur location|hours and location)$/.test(text)) return "visit";
  return null;
}

function bookingReply(lang: Lang): AgentReply {
  return {
    intent: "booking",
    text: T(
      lang,
      "Booking takes about a minute: choose a department or doctor, pick a free time, and enter your name and phone. You get a reference and a slip.",
      "Booking mein takreeban ek minute lagta hai: department ya doctor chunein, khali waqt select karein, aur apna naam aur phone likhein. Aap ko reference aur slip mil jayegi.",
    ),
    links: [{ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" }],
  };
}

function doctorsReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const names = pack.departments.map((d) => d.name).join(", ");
  return {
    intent: "doctors",
    text: T(
      lang,
      `We have ${pack.doctors.length} doctors in ${pack.departments.length} departments: ${names}. Which department do you need? You can also tell me what the problem is and I'll suggest where to start.`,
      `Hamare paas ${pack.departments.length} departments mein ${pack.doctors.length} doctors hain: ${names}. Aap ko kis department ki zaroorat hai? Masla bataiye, main bata dunga kahan se shuru karein.`,
    ),
    links: [{ label: T(lang, "All doctors", "Tamam doctors"), href: "/doctors" }],
    suggestions: pack.departments.slice(0, 3).map((d) => T(lang, `${d.name} doctors`, `${d.name} doctors`)),
  };
}

function labsReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const tests = pack.labTests.map((t) => t.pricePkr);
  const fees = pack.doctors.map((d) => d.feePkr);
  const from = tests.length ? pkr(Math.min(...tests)) : "";
  const feeRange = fees.length ? `${pkr(Math.min(...fees))}–${pkr(Math.max(...fees))}` : "";
  return {
    intent: "lab_overview",
    text: T(
      lang,
      `We offer ${pack.labTests.length} lab tests${from ? ` from ${from}` : ""} and ${pack.packages.length} health packages. Doctor consultations are ${feeRange || "listed on each doctor's page"} (all sample prices). Tell me a test name, for example "CBC", for its exact price and report time.`,
      `Hamare paas ${pack.labTests.length} lab tests${from ? ` (${from} se shuru)` : ""} aur ${pack.packages.length} health packages hain. Doctor ki consultation fee ${feeRange || "har doctor ke page par"} hai (sab sample prices). Kisi test ka naam likhiye, jaise "CBC", main us ki qeemat aur report ka waqt bata dunga.`,
    ),
    links: [
      { label: T(lang, "Lab tests", "Lab tests"), href: "/lab-tests" },
      { label: T(lang, "Health packages", "Health packages"), href: "/health-packages" },
    ],
  };
}

function visitReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const { clinic } = pack;
  return {
    intent: "visit",
    text: T(
      lang,
      `We are open ${clinic.hours}; the lab is open ${clinic.labHours}. You'll find us at ${clinic.address.join(", ")}. Phone ${clinic.phone}.`,
      `Clinic ${clinic.hours} khula hai; lab ${clinic.labHours} khuli hai. Hamara pata: ${clinic.address.join(", ")}. Phone ${clinic.phone}.`,
    ),
    links: [{ label: T(lang, "Contact and map", "Contact aur map"), href: "/contact" }],
  };
}

function homeCollectionReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const home = pack.labTests.filter((t) => t.homeCollection).map((t) => t.name);
  const list = home.slice(0, 6).join(", ");
  return {
    intent: "home_collection",
    text: home.length
      ? T(
          lang,
          `Yes, home sample collection is available for ${home.length} tests, for example ${list}. Book the test and choose home collection, or call ${pack.clinic.phone}.`,
          `Ji haan, ${home.length} tests ke liye ghar se sample liya ja sakta hai, jaise ${list}. Test book karein aur home collection chunein, ya ${pack.clinic.phone} par call karein.`,
        )
      : T(lang, `Please call ${pack.clinic.phone} to ask about home sample collection.`, `Ghar se sample ke liye ${pack.clinic.phone} par call karein.`),
    links: [{ label: T(lang, "Lab tests", "Lab tests"), href: "/lab-tests" }],
  };
}

function reportReply(pack: KnowledgePack, lang: Lang): AgentReply {
  const times = [...new Set(pack.labTests.map((t) => t.reportTime).filter(Boolean))].slice(0, 3).join("; ");
  return {
    intent: "report",
    text: T(
      lang,
      `Report time depends on the test${times ? ` (for example: ${times})` : ""}. Tell me the test name for its exact report time. Reports are shared only with you, never through a public link.`,
      `Report ka waqt test par depend karta hai${times ? ` (misaal: ${times})` : ""}. Test ka naam bataiye, main us ki report ka sahi waqt bata dunga. Report sirf aap ko di jati hai, kisi public link par nahi.`,
    ),
    links: [{ label: T(lang, "Lab tests", "Lab tests"), href: "/lab-tests" }],
  };
}

function fallback(pack: KnowledgePack, lang: Lang): AgentReply {
  return {
    intent: "unknown",
    text: T(
      lang,
      `I'm not sure I understood that yet, but I'd love to help! I can book appointments, find the right doctor, share lab test prices, and tell you our timings and location. Pick an option below or ask in your own words.`,
      `Main yeh poori tarah samajh nahi paya, lekin madad zaroor karunga! Main appointment book karne, sahi doctor dhoondne, lab tests ki qeemat aur timings aur location mein madad kar sakta hoon. Neeche se koi option chunein ya apne alfaaz mein poochein.`,
    ),
    links: [
      { label: "FAQ", href: "/faq" },
      { label: T(lang, "Contact us", "Rabta karein"), href: "/contact" },
    ],
    suggestions: QUICK_REPLIES[lang],
  };
}

function answerTopic(question: string, pack: KnowledgePack, lang: Lang): AgentReply {
  const clean = cleanText(question);
  const words = tokens(question);
  const { clinic } = pack;
  // Entity matching uses the specific words, with and without synonyms ("women" and "gynecology").
  const specific = [...new Set([...words, ...rawWords(question)])].filter((w) => !GENERIC.has(w));

  const quick = quickReply(clean);
  if (quick === "book") return bookingReply(lang);
  if (quick === "doctors") return doctorsReply(pack, lang);
  if (quick === "labs") return labsReply(pack, lang);
  if (quick === "visit") return visitReply(pack, lang);

  // Entities first: a question that names a doctor or a test is about that, even with a symptom word.
  const doctor = best(pack.doctors, specific, (d) => nameTokens(d.name));
  const department = best(pack.departments, words.filter((w) => !GENERIC.has(w)), (d) => [...nameTokens(d.name), ...nameTokens(d.slug)]);
  const test = best(pack.labTests, specific, (t) => [...nameTokens(t.name), ...t.aka.flatMap(nameTokens), ...nameTokens(t.slug)]);
  const pack_ = best(pack.packages, specific, (p) => nameTokens(p.name).filter((w) => !GENERIC.has(w)));
  const specialty = best(pack.doctors, words.filter((w) => !GENERIC.has(w)), (d) => nameTokens(d.specialty));

  if (SYMPTOM.test(clean) && !doctor && !test && !pack_) return symptomReply(clean, pack, lang);

  if (doctor && doctor.score >= 1 && (!test || doctor.score >= test.score)) {
    const d = doctor.item;
    const dept = d.departmentName || d.specialty;
    const extra = d.specialty && d.specialty !== d.departmentName ? ` (${d.specialty})` : "";
    const days = d.days.map((day) => DAY[day] ?? day).join(", ");
    return {
      intent: "doctor",
      // The catalog's "specialty" is often the department name itself ("Gynecology"), so say it once.
      text: T(
        lang,
        `${d.name} works in ${dept}${extra}. Consultation fee: ${pkr(d.feePkr)} (sample). Usually available: ${days}.`,
        `${d.name} ${dept}${extra} mein hain. Consultation fee: ${pkr(d.feePkr)} (sample). Aam tor par in dinon mein: ${days}.`,
      ),
      links: [
        { label: T(lang, `About ${d.name}`, `${d.name} ke baare mein`), href: `/doctors/${d.slug}` },
        { label: T(lang, `Book with ${d.name}`, `${d.name} se appointment`), href: `/book-appointment?doctor=${encodeURIComponent(d.slug)}` },
      ],
    };
  }

  if (test && (!pack_ || test.score >= pack_.score)) {
    const t = test.item;
    const parts =
      lang === "roman"
        ? [
            `${t.name} ki fee ${pkr(t.pricePkr)} hai (sample price).`,
            t.sampleType ? `Sample: ${t.sampleType}.` : "",
            t.reportTime ? `Report: ${t.reportTime}.` : "",
            t.preparation ? `Tayyari: ${t.preparation}.` : "",
            t.homeCollection ? "Ghar se sample bhi liya ja sakta hai." : "",
          ]
        : [
            `${t.name} costs ${pkr(t.pricePkr)} (sample price).`,
            t.sampleType ? `Sample: ${t.sampleType}.` : "",
            t.reportTime ? `Report: ${t.reportTime}.` : "",
            t.preparation ? `Preparation: ${t.preparation}.` : "",
            t.homeCollection ? "Home sample collection is available." : "",
          ];
    return { intent: "lab_test", text: parts.filter(Boolean).join(" "), links: [{ label: `${t.name} details`, href: `/lab-tests/${t.slug}` }, { label: "All lab tests", href: "/lab-tests" }] };
  }

  // "heart doctor" asks for a department, not the "Heart Check" package.
  const wantsDoctor = has(words, "doctor") && (department !== null || specialty !== null) && !has(words, "package");
  if (pack_ && !wantsDoctor) {
    const p = pack_.item;
    return {
      intent: "package",
      text: `${p.name}: ${pkr(p.pricePkr)} (sample price). ${p.whoFor}${p.preparation ? ` ${T(lang, "Preparation", "Tayyari")}: ${p.preparation}.` : ""}`,
      links: [{ label: "Health packages", href: "/health-packages" }],
    };
  }

  const dept = department ?? (specialty ? { item: pack.departments.find((x) => x.slug === specialty.item.departmentSlug), score: specialty.score } : null);
  if (dept?.item) {
    const dp = dept.item;
    const team = pack.doctors.filter((d) => d.departmentSlug === dp.slug);
    const list = team.map((d) => `${d.name} (${pkr(d.feePkr)})`).join(", ");
    return {
      intent: "department",
      text: `${dp.name}: ${dp.summary}${team.length ? ` ${T(lang, "Doctors", "Doctors")}: ${list}.` : ""}`,
      links: [
        { label: `${dp.name} department`, href: `/departments/${dp.slug}` },
        { label: T(lang, `Book in ${dp.name}`, `${dp.name} mein booking`), href: `/book-appointment?department=${encodeURIComponent(dp.slug)}` },
      ],
    };
  }

  if (has(words, "home") && has(words, "sample", "test")) return homeCollectionReply(pack, lang);
  if (has(words, "report") && (has(words, "when", "hours", "ready", "milegi", "milega", "milay") || words.length === 1)) return reportReply(pack, lang);
  if (has(words, "hours") && has(words, "location")) return visitReply(pack, lang);
  if (has(words, "hours") || (has(words, "when") && words.length <= 2)) {
    return {
      intent: "hours",
      text: T(lang, `We are open ${clinic.hours}. The lab is open ${clinic.labHours}.`, `Clinic ${clinic.hours} khula hai. Lab ${clinic.labHours} khuli hai.`),
      links: [{ label: T(lang, "Book an appointment", "Appointment book karein"), href: "/book-appointment" }],
      suggestions: [T(lang, "How do I book?", "Booking kaise karein?")],
    };
  }
  if (has(words, "location", "contact")) {
    return {
      intent: "contact",
      text: T(lang, `${clinic.name}: ${clinic.address.join(", ")}. Phone ${clinic.phone}.`, `${clinic.name} ka pata: ${clinic.address.join(", ")}. Phone ${clinic.phone}.`),
      links: [{ label: T(lang, "Contact and map", "Contact aur map"), href: "/contact" }],
    };
  }
  if (has(words, "test") && has(words, "fee")) return labsReply(pack, lang);
  if (has(words, "fee")) {
    const fees = pack.doctors.map((d) => d.feePkr);
    const tests = pack.labTests.map((t) => t.pricePkr);
    const range = fees.length ? `${pkr(Math.min(...fees))} – ${pkr(Math.max(...fees))}` : "";
    const lab = tests.length ? pkr(Math.min(...tests)) : "";
    return {
      intent: "fees",
      text: T(
        lang,
        `Consultation fees are ${range || "on each doctor's page"}${lab ? `; lab tests start at ${lab}` : ""} (sample prices). Ask me about a doctor or a test for the exact price.`,
        `Consultation fee ${range || "har doctor ke page par"} hai${lab ? `; lab tests ${lab} se shuru hote hain` : ""} (sample prices). Kisi doctor ya test ka naam bataiye, main sahi qeemat bata dunga.`,
      ),
      links: [
        { label: "Doctors", href: "/doctors" },
        { label: "Lab tests", href: "/lab-tests" },
      ],
    };
  }
  if (has(words, "doctor")) return doctorsReply(pack, lang);
  if (has(words, "test")) return labsReply(pack, lang);
  if (has(words, "book")) return bookingReply(lang);

  const faq = best(pack.faqs, [...new Set([...words, ...rawWords(question)])], (f) => nameTokens(f.question), 2);
  if (faq) return { intent: "faq", text: faq.item.answer, links: [{ label: T(lang, "More answers", "Mazeed jawab"), href: `/faq#${faq.item.groupSlug}` }] };

  return fallback(pack, lang);
}

export function answerPatient(question: string, pack: KnowledgePack): AgentReply {
  const lang = detectLang(question);
  if (EMERGENCY.test(cleanText(question))) return emergencyReply(pack, lang);

  const social = readSocial(question);
  if (social.kinds.length && !social.rest) return socialReply(social.kinds, pack, lang);
  if (social.kinds.length && social.rest) {
    // "hi, what are your timings?": answer the question, opened warmly.
    const reply = answerTopic(social.rest, pack, lang);
    if (reply.intent === "unknown") return socialReply(social.kinds, pack, lang);
    const greeted = social.kinds.some((k) => k !== "thanks" && k !== "bye" && k !== "help" && k !== "about");
    return greeted ? { ...reply, text: `${opener(social.kinds, lang)} ${reply.text}` } : reply;
  }
  return answerTopic(question, pack, lang);
}

export function answerGuide(question: string): AgentReply {
  const words = tokens(question);
  const raw = cleanText(question).split(" ");
  const all = [...new Set([...words, ...raw])];
  const topic = best(GUIDE_TOPICS, all, (t) => t.keywords);
  if (!topic) {
    return {
      intent: "guide_unknown",
      text: "I can explain what the system includes, how it looks for your specialty, the staff dashboard, booking slips, security and branding.",
      suggestions: GUIDE_SUGGESTIONS,
    };
  }
  return { intent: `guide_${topic.item.id}`, text: topic.item.text, links: topic.item.links };
}

export function answer(request: AgentRequest, pack: KnowledgePack): AgentReply {
  const question = request.question.trim();
  if (!question) return { intent: "empty", text: "Please type a question." };
  if (question.length > MAX_QUESTION) return { intent: "too_long", text: `Please keep your question under ${MAX_QUESTION} characters.` };
  if (request.mode === "guide" && pack.demo) return answerGuide(question);
  return answerPatient(question, pack);
}

/** The free provider: runs in the browser, makes no network call. */
export function createLocalProvider(pack: KnowledgePack): AgentProvider {
  return { id: "local", answer: async (request) => answer(request, pack) };
}
