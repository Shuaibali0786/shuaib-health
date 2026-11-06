// The free, built-in answer engine (Feature 010, ADR-0013). Deterministic: it finds what the question is
// about (intent words plus the best-matching doctor, department, lab test, package or FAQ) and answers
// ONLY from the knowledge pack. When nothing matches it says so; it never invents.

import { MAX_QUESTION, cleanText, nameTokens, tokens } from "./normalize";
import { GUIDE_SUGGESTIONS, GUIDE_TOPICS } from "./productGuide";
import type { AgentLink, AgentProvider, AgentReply, AgentRequest, KnowledgePack } from "./types";

export const PATIENT_SUGGESTIONS = ["When are you open?", "Which doctors are available?", "Price of a blood test", "How do I book?"];

const EMERGENCY = /\b(emergency|urgent|chest pain|cant breathe|can t breathe|not breathing|unconscious|bleeding|heart attack|stroke|suicid|overdose|seizure|faint)/;
const SYMPTOM = /\b(pain|fever|cough|dard|bukhar|headache|rash|vomit|vomiting|diarrh|dizzy|diagnos|medicine|medication|dose|tablet|treatment for|cure|symptom|sick|ill|infection|bp|sugar level|pregnan)/;

const pkr = (n: number) => `PKR ${n.toLocaleString("en-US")}`;
const DAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

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

export function answerPatient(question: string, pack: KnowledgePack): AgentReply {
  const clean = cleanText(question);
  const words = tokens(question);
  const { clinic } = pack;
  const bookLink: AgentLink = { label: "Book an appointment", href: "/book-appointment" };

  if (EMERGENCY.test(clean)) {
    return {
      intent: "emergency",
      text: `If this is an emergency, call your local emergency number now. The clinic's emergency line is ${clinic.emergencyPhone}. I can't help with urgent medical problems in chat.`,
      links: [{ label: `Call ${clinic.emergencyPhone}`, href: `tel:${clinic.emergencyPhone.replace(/[^\d+]/g, "")}` }],
    };
  }

  // Entities first: a question that names a doctor or a test is about that, even with a symptom word.
  const doctor = best(pack.doctors, words, (d) => nameTokens(d.name));
  const department = best(pack.departments, words, (d) => [...nameTokens(d.name), ...nameTokens(d.slug)]);
  const test = best(pack.labTests, words, (t) => [...nameTokens(t.name), ...t.aka.flatMap(nameTokens), ...nameTokens(t.slug)]);
  const pack_ = best(pack.packages, words, (p) => nameTokens(p.name).filter((w) => w !== "package"));
  const specialty = best(pack.doctors, words, (d) => nameTokens(d.specialty));

  if (SYMPTOM.test(clean) && !doctor && !test && !pack_) {
    return {
      intent: "symptom",
      text: "I can't give medical advice or a diagnosis. Please book a consultation so a doctor can help. If it is urgent, call your local emergency number.",
      links: [bookLink, { label: "See our doctors", href: "/doctors" }],
      suggestions: ["Which doctors are available?", "When are you open?"],
    };
  }

  if (doctor && doctor.score >= 1 && (!test || doctor.score >= test.score)) {
    const d = doctor.item;
    return {
      intent: "doctor",
      text: `${d.name} is a ${d.specialty} (${d.departmentName}). Consultation fee: ${pkr(d.feePkr)} (sample). Usually available: ${d.days.map((day) => DAY[day] ?? day).join(", ")}.`,
      links: [
        { label: `About ${d.name}`, href: `/doctors/${d.slug}` },
        { label: `Book with ${d.name}`, href: `/book-appointment?doctor=${encodeURIComponent(d.slug)}` },
      ],
    };
  }

  if (test && (!pack_ || test.score >= pack_.score)) {
    const t = test.item;
    const parts = [
      `${t.name} costs ${pkr(t.pricePkr)} (sample price).`,
      t.sampleType ? `Sample: ${t.sampleType}.` : "",
      t.reportTime ? `Report: ${t.reportTime}.` : "",
      t.preparation ? `Preparation: ${t.preparation}.` : "",
      t.homeCollection ? "Home sample collection is available." : "",
    ];
    return { intent: "lab_test", text: parts.filter(Boolean).join(" "), links: [{ label: `${t.name} details`, href: `/lab-tests/${t.slug}` }, { label: "All lab tests", href: "/lab-tests" }] };
  }

  if (pack_) {
    const p = pack_.item;
    return {
      intent: "package",
      text: `${p.name}: ${pkr(p.pricePkr)} (sample price). ${p.whoFor}${p.preparation ? ` Preparation: ${p.preparation}.` : ""}`,
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
      text: `${dp.name}: ${dp.summary}${team.length ? ` Doctors: ${list}.` : ""}`,
      links: [
        { label: `${dp.name} department`, href: `/departments/${dp.slug}` },
        { label: `Book in ${dp.name}`, href: `/book-appointment?department=${encodeURIComponent(dp.slug)}` },
      ],
    };
  }

  if (has(words, "hours")) {
    return { intent: "hours", text: `We are open ${clinic.hours}. The lab is open ${clinic.labHours}.`, links: [bookLink], suggestions: ["How do I book?"] };
  }
  if (has(words, "location", "contact")) {
    return {
      intent: "contact",
      text: `${clinic.name}: ${clinic.address.join(", ")}. Phone ${clinic.phone}.`,
      links: [{ label: "Contact and map", href: "/contact" }],
    };
  }
  if (has(words, "fee")) {
    const fees = pack.doctors.map((d) => d.feePkr);
    const tests = pack.labTests.map((t) => t.pricePkr);
    const range = fees.length ? `Consultation fees are ${pkr(Math.min(...fees))} to ${pkr(Math.max(...fees))}` : "Consultation fees are on each doctor's page";
    const lab = tests.length ? `; lab tests start at ${pkr(Math.min(...tests))}` : "";
    return { intent: "fees", text: `${range}${lab} (sample prices). Ask me about a doctor or a test for the exact price.`, links: [{ label: "Doctors", href: "/doctors" }, { label: "Lab tests", href: "/lab-tests" }] };
  }
  if (has(words, "doctor")) {
    return {
      intent: "doctors",
      text: `We have ${pack.doctors.length} doctors in ${pack.departments.length} departments: ${pack.departments.map((d) => d.name).join(", ")}. Which department do you need?`,
      links: [{ label: "All doctors", href: "/doctors" }],
      suggestions: pack.departments.slice(0, 3).map((d) => `${d.name} doctors`),
    };
  }
  if (has(words, "test")) {
    return { intent: "lab_tests", text: `We offer ${pack.labTests.length} lab tests and ${pack.packages.length} health packages. Tell me a test name, for example "CBC".`, links: [{ label: "Lab tests", href: "/lab-tests" }] };
  }
  if (has(words, "book")) {
    return {
      intent: "booking",
      text: "Booking takes about a minute: choose a department or doctor, pick a free time, and enter your name and phone. You get a reference and a slip.",
      links: [bookLink],
    };
  }

  const faq = best(pack.faqs, words, (f) => nameTokens(f.question), 2);
  if (faq) {
    return { intent: "faq", text: faq.item.answer, links: [{ label: "More answers", href: `/faq#${faq.item.groupSlug}` }] };
  }

  return {
    intent: "unknown",
    text: "Sorry, I don't have an answer for that. I can help with timings, doctors, departments, lab tests, fees and booking.",
    links: [{ label: "FAQ", href: "/faq" }, { label: "Contact us", href: "/contact" }],
    suggestions: PATIENT_SUGGESTIONS,
  };
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
