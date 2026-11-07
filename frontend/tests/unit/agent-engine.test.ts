// Feature 010 (v1.1): the free local answer engine, its normaliser, throttle, knowledge pack and flag.
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildKnowledgePack, emergencyNumbersFor } from "@/agent/knowledge";
import { QUICK_REPLIES, answer, welcomeMessage } from "@/agent/localEngine";
import { MAX_QUESTION, detectLang, tokens } from "@/agent/normalize";
import { getProvider } from "@/agent/registry";
import { createThrottle } from "@/agent/throttle";
import type { AgentMode, KnowledgePack } from "@/agent/types";
import { faqGroups } from "@/data/faq";
import { isAssistantEnabled } from "@/lib/demo";

import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";

const pack: KnowledgePack = buildKnowledgePack({ site: siteConfig, departments, doctors, labTests, packages: healthPackages, faqGroups, demo: true });
const ask = (question: string, mode: AgentMode = "patient") => answer({ mode, question }, pack);

// [question, expected intent, text the answer must contain (optional), expected language (optional)]
// v1.1: 100 questions in English, Roman Urdu, Urdu and Arabic script; every one must pass (SC-001 raised to 100%).
type Case = [string, string, string?, ("en" | "roman")?];
const PATIENT_SET: Case[] = [
  // Greetings and small talk (owner's live test: these used to get "Sorry, I don't have an answer")
  ["hi", "greeting", "I'm the clinic's assistant", "en"],
  ["Hello", "greeting", "Welcome to Shuaib Health", "en"],
  ["hey there", "greeting", "How can I help you today?", "en"],
  ["good morning", "greeting", "Good morning!", "en"],
  ["Good evening", "greeting", "Good evening!", "en"],
  ["salam", "greeting", "Wa alaikum assalam!", "roman"],
  ["Assalam o alaikum", "greeting", "Wa alaikum assalam!", "roman"],
  ["assalamualaikum", "greeting", "Wa alaikum assalam!", "roman"],
  ["AOA", "greeting", "khush aamdeed", "roman"],
  ["السلام علیکم", "greeting", "Wa alaikum assalam!", "roman"],
  ["مرحبا", "greeting", "Marhaba!", "en"],
  ["marhaba", "greeting", "Marhaba!", "en"],
  ["what do you do", "about", "I'm Shuaib Health's assistant", "en"],
  ["who are you?", "about", "assistant", "en"],
  ["aap kaun ho", "about", "Main Shuaib Health ka assistant hoon", "roman"],
  ["help", "help", "I can't give medical advice", "en"],
  ["thanks", "thanks", "You're very welcome", "en"],
  ["thank you so much", "thanks", "welcome", "en"],
  ["shukriya", "thanks", "Koi baat nahi", "roman"],
  ["شکریہ", "thanks", "Koi baat nahi", "roman"],
  ["bye", "bye", "Goodbye", "en"],
  ["Allah hafiz", "bye", "Allah Hafiz", "roman"],
  ["how are you", "how_are_you", "doing well", "en"],
  ["hi, what are your timings?", "hours", "Hello! We are open", "en"],
  ["salam, timing kya hai", "hours", "Wa alaikum assalam! Clinic", "roman"],
  // Quick replies
  ["Book appointment", "booking", "Booking takes about a minute", "en"],
  ["Find a doctor", "doctors", "Which department do you need?", "en"],
  ["Lab tests and fees", "lab_overview", "lab tests", "en"],
  ["Timings and location", "visit", "We are open", "en"],
  ["Appointment book karein", "booking", "Booking mein", "roman"],
  ["Lab tests aur fees", "lab_overview", "Hamare paas", "roman"],
  ["Timings aur location", "visit", "Hamara pata", "roman"],
  // Timings and location
  ["When are you open?", "hours", "We are open", "en"],
  ["clinic timings", "hours"],
  ["timing kya hai", "hours", "khula hai", "roman"],
  ["what time do you close on saturday", "hours"],
  ["clinic kab khulta hai", "hours", "khula hai", "roman"],
  ["where is the clinic", "contact", "Sample Road", "en"],
  ["clinic kahan hai", "contact", "ka pata", "roman"],
  ["phone number", "contact"],
  ["timings and address", "visit"],
  // Doctors
  ["Who is Dr Ayesha Rahman?", "doctor", "Gynecology", "en"],
  ["fee for dr imran", "doctor", "Imran Qureshi"],
  ["Dr Bilal fees kitni hai", "doctor", "Bilal Ansari", "roman"],
  ["is dr hassan available", "doctor", "Hassan Mirza"],
  ["omar sheikh", "doctor", "Omar Sheikh"],
  ["Dr Sana kab aati hain", "doctor", "Sana", "roman"],
  ["which doctors are available", "doctors"],
  ["doctor chahiye", "doctors", "Hamare paas", "roman"],
  ["koi acha doctor", "doctors", undefined, "en"],
  // Departments
  ["dermatology doctors", "department", "Dermatology"],
  ["skin specialist", "department", "Dermatology"],
  ["heart doctor", "department", "Cardiology"],
  ["child specialist", "department", "Pediatrics"],
  ["dentist", "department", "Dental"],
  ["gynae doctor", "department", "Gynecology"],
  ["bachon ka doctor", "department", "Pediatrics", "roman"],
  // Lab tests
  ["cbc price", "lab_test", "Complete Blood Count"],
  ["How much is a CBC test?", "lab_test", "PKR"],
  ["hba1c test", "lab_test", "HbA1c"],
  ["sugar test", "lab_test"],
  ["lipid profile cost", "lab_test", "Lipid Profile"],
  ["cholesterol test", "lab_test", "Lipid"],
  ["LFT", "lab_test", "Liver"],
  ["TSH test price", "lab_test", "Thyroid"],
  ["uric acid", "lab_test", "Uric"],
  ["hepatitis b test", "lab_test", "Hepatitis B"],
  ["creatinine", "lab_test", "Creatinine"],
  ["cbc test kitne ka hai", "lab_test", "ki fee", "roman"],
  ["sugar test ki qeemat", "lab_test", "ki fee", "roman"],
  ["test kitne ka hai", "lab_overview", "Hamare paas", "roman"],
  ["lab test prices", "lab_overview"],
  ["ghar se sample", "home_collection", "ghar se sample", "roman"],
  ["do you do home sample collection", "home_collection", "home sample collection", "en"],
  ["report kab milegi", "report", "Report ka waqt", "roman"],
  ["when will my report be ready", "report", "Report time depends on the test", "en"],
  // Packages
  ["diabetes care package", "package", "Diabetes Care"],
  ["senior citizen package price", "package", "Senior Citizen"],
  ["women's health package", "package", "Women"],
  // Fees and booking
  ["consultation fees", "fees", "Consultation fees are"],
  ["fees kitni hai", "fees", "Consultation fee", "roman"],
  ["how do I book an appointment", "booking"],
  ["appointment kaise lein", "booking", "Booking mein", "roman"],
  ["booking karni hai", "booking", "Booking mein", "roman"],
  // Symptoms -> department (no diagnosis, safety line always)
  ["I have stomach pain", "symptom", "General Medicine", "en"],
  ["tooth pain", "symptom", "Dental", "en"],
  ["skin rash", "symptom", "Dermatology", "en"],
  ["my child has fever", "symptom", "Pediatrics", "en"],
  ["pet mein dard hai", "symptom", "General Medicine", "roman"],
  ["daant mein dard", "symptom", "Dental", "roman"],
  ["khujli ho rahi hai", "symptom", "Dermatology", "roman"],
  ["bachay ko bukhar hai", "symptom", "Pediatrics", "roman"],
  ["I have fever and headache what medicine", "symptom", "General Medicine"],
  ["period pain", "symptom", "Gynecology"],
  // Emergency
  ["chest pain emergency", "emergency", "1122 or 115", "en"],
  ["saans nahi aa rahi", "emergency", "1122 or 115", "roman"],
  // FAQ and fallback
  ["can I pay online", "faq"],
  ["can you explain my results", "faq"],
  ["what is the meaning of life", "unknown", "I'd love to help", "en"],
  ["asdfgh", "unknown", "Pick an option below"],
];

describe("local engine — patient mode (100-question accuracy set, must be 100%)", () => {
  it("has 100 questions and answers every one as expected", () => {
    expect(PATIENT_SET).toHaveLength(100);
    const misses = PATIENT_SET.flatMap(([q, intent, text, lang]) => {
      const reply = ask(q);
      const wrong: string[] = [];
      if (reply.intent !== intent) wrong.push(`intent ${reply.intent} (want ${intent})`);
      if (text !== undefined && !reply.text.includes(text)) wrong.push(`text lacks "${text}": ${reply.text}`);
      if (lang !== undefined && detectLang(q) !== lang) wrong.push(`lang ${detectLang(q)} (want ${lang})`);
      return wrong.length ? [`${q} -> ${wrong.join("; ")}`] : [];
    });
    expect(misses, misses.join("\n")).toEqual([]);
  });

  it("never starts an answer with Sorry, in any language", () => {
    for (const [q] of PATIENT_SET) expect(ask(q).text, q).not.toMatch(/^\s*(sorry|maaf|maazrat)/i);
  });

  it("offers the four quick replies with a greeting, small talk and the fallback", () => {
    for (const q of ["hi", "what do you do", "asdfgh"]) expect(ask(q).suggestions).toEqual(QUICK_REPLIES.en);
    expect(ask("salam").suggestions).toEqual(QUICK_REPLIES.roman);
  });

  it("answers only with data from the pack (doctor fee is the catalog fee)", () => {
    const ayesha = doctors.find((d) => d.fullName === "Dr. Ayesha Rahman");
    const reply = ask("Dr Ayesha Rahman fee");
    expect(reply.text).toContain(`PKR ${ayesha?.feePkr.toLocaleString("en-US")}`);
    expect(reply.links?.some((l) => l.href === `/book-appointment?doctor=${ayesha?.slug}`)).toBe(true);
  });

  it("never gives medical advice: a symptom names only where to start, with the safety line", () => {
    const reply = ask("my child has a cough, which tablet should I give?");
    expect(reply.intent).toBe("symptom");
    expect(reply.department).toBe("pediatrics");
    expect(reply.text).toMatch(/can't give medical advice/);
    expect(reply.text).toMatch(/This is not medical advice\. If it is an emergency, call 1122 or 115 or go to the nearest emergency department\./);
    expect(reply.text).not.toMatch(/\b(take|dose|mg|tablet|syrup|you have)\b/i);
    expect(reply.links?.[0]?.href).toBe("/book-appointment?department=pediatrics");
    const roman = ask("pet mein dard hai");
    expect(roman.text).toMatch(/Yeh medical mashwara nahi hai/);
  });

  it("gives the clinic's emergency line and the country's numbers", () => {
    const text = ask("emergency!").text;
    expect(text).toContain(siteConfig.emergencyPhone.display);
    expect(text).toContain("1122 or 115");
  });

  it("uses each client's own emergency numbers from the clinic time zone", () => {
    expect(emergencyNumbersFor("Asia/Karachi")).toBe("1122 or 115");
    expect(emergencyNumbersFor("Europe/London")).toBe("999 or 112");
    expect(emergencyNumbersFor("Asia/Dubai")).toContain("998");
    expect(emergencyNumbersFor("America/Chicago")).toBe("your local emergency number");
  });

  it("refuses empty and over-long questions", () => {
    expect(ask("   ").intent).toBe("empty");
    expect(ask("x".repeat(MAX_QUESTION + 1)).intent).toBe("too_long");
  });

  it("the widget's first message is the warm welcome", () => {
    expect(welcomeMessage(pack)).toMatch(/^Hello! Welcome to Shuaib Health\. I'm the clinic's assistant\./);
  });
});

describe("local engine — product guide mode", () => {
  it.each([
    ["What do I get?", "guide_overview"],
    ["Does it work for a dental clinic?", "guide_dental"],
    ["skin and laser clinic", "guide_skin"],
    ["diagnostic lab with home collection", "guide_lab"],
    ["show me the admin dashboard", "guide_dashboard"],
    ["is patient data secure", "guide_security"],
    ["can I use my own logo and colours", "guide_brand"],
    ["is the chatbot AI", "guide_assistant"],
  ])("%s -> %s", (q, intent) => {
    expect(ask(q, "guide").intent).toBe(intent);
  });

  it("links a specialty answer to its preset demo", () => {
    expect(ask("dental", "guide").links?.[0]?.href).toBe("/demo/specialties/dental");
  });

  it("is not available when the demo is off (falls back to patient mode)", () => {
    const realClinic = { ...pack, demo: false };
    expect(answer({ mode: "guide", question: "When are you open?" }, realClinic).intent).toBe("hours");
  });
});

describe("normalize", () => {
  it("maps Roman Urdu and spelling variants, drops stop words", () => {
    expect(tokens("Timing kya hai?")).toEqual(["hours"]);
    expect(tokens("Fees kitni hai")).toEqual(["fee"]);
    expect(tokens("Paediatrician for my child")).toEqual(["pediatrics"]);
  });
});

describe("throttle", () => {
  it("allows 8 a minute, then pauses, then allows again after the minute", () => {
    let t = 0;
    const throttle = createThrottle(() => t);
    for (let i = 0; i < 8; i++) expect(throttle.take().ok).toBe(true);
    const blocked = throttle.take();
    expect(blocked.ok).toBe(false);
    t = 60_001;
    expect(throttle.take().ok).toBe(true);
  });

  it("stops after 60 in a session", () => {
    let t = 0;
    const throttle = createThrottle(() => (t += 10_000));
    for (let i = 0; i < 60; i++) expect(throttle.take().ok).toBe(true);
    expect(throttle.take()).toMatchObject({ ok: false, reason: "session" });
  });
});

describe("knowledge pack", () => {
  it("contains only allow-listed public fields", () => {
    expect(Object.keys(pack).sort()).toEqual(["clinic", "demo", "departments", "doctors", "faqs", "labTests", "packages"]);
    expect(Object.keys(pack.doctors[0] ?? {}).sort()).toEqual(["days", "departmentName", "departmentSlug", "feePkr", "name", "slug", "specialty"]);
    expect(Object.keys(pack.clinic).sort()).toEqual(["address", "emergencyNumbers", "emergencyPhone", "hours", "labHours", "name", "phone"]);
    // No e-mail address and no Pakistani mobile number (patients' contact details are never in the catalog).
    expect(JSON.stringify(pack)).not.toMatch(/[a-z0-9._-]+@[a-z0-9-]+\.[a-z]|\b03\d{2}[ -]?\d{7}\b/i);
  });

  it("the registry gives the local provider", async () => {
    const provider = getProvider(pack);
    expect(provider.id).toBe("local");
    expect((await provider.answer({ mode: "patient", question: "When are you open?" })).intent).toBe("hours");
  });
});

describe("ASSISTANT_ENABLED", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is off by default and only on for an explicit yes", () => {
    vi.stubEnv("ASSISTANT_ENABLED", "");
    expect(isAssistantEnabled()).toBe(false);
    vi.stubEnv("ASSISTANT_ENABLED", "false");
    expect(isAssistantEnabled()).toBe(false);
    vi.stubEnv("ASSISTANT_ENABLED", "true");
    expect(isAssistantEnabled()).toBe(true);
  });
});

describe("doctor wording", () => {
  it("names the department once when the specialty is the department", () => {
    const text = answer({ mode: "patient", question: "Dr Ayesha Rahman" }, pack).text;
    expect(text).toMatch(/^Dr\. Ayesha Rahman works in Gynecology\. Consultation fee/);
  });
});
