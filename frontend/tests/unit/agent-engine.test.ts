// Feature 010: the free local answer engine, its normaliser, throttle, knowledge pack and flag.
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildKnowledgePack } from "@/agent/knowledge";
import { answer } from "@/agent/localEngine";
import { MAX_QUESTION, tokens } from "@/agent/normalize";
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

// [question, expected intent, text the answer must contain (optional)]
const PATIENT_SET: Array<[string, string, string?]> = [
  ["When are you open?", "hours"],
  ["clinic timings", "hours"],
  ["timing kya hai", "hours"],
  ["what time do you close on saturday", "hours"],
  ["Who is Dr Ayesha Rahman?", "doctor", "Gynecology"],
  ["fee for dr imran", "doctor", "Imran Qureshi"],
  ["Dr Bilal fees kitni hai", "doctor", "Bilal Ansari"],
  ["is dr hassan available", "doctor", "Hassan Mirza"],
  ["omar sheikh", "doctor", "Omar Sheikh"],
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
  ["diabetes care package", "package", "Diabetes Care"],
  ["senior citizen package price", "package", "Senior Citizen"],
  ["women's health package", "package", "Women"],
  ["dermatology doctors", "department", "Dermatology"],
  ["skin specialist", "department", "Dermatology"],
  ["heart doctor", "department", "Cardiology"],
  ["child specialist", "department", "Pediatrics"],
  ["dentist", "department", "Dental"],
  ["gynae doctor", "department", "Gynecology"],
  ["which doctors are available", "doctors"],
  ["where is the clinic", "contact"],
  ["phone number", "contact"],
  ["how do I book an appointment", "booking"],
  ["appointment kaise lein", "booking"],
  ["consultation fees", "fees"],
  ["I have fever and headache what medicine", "symptom"],
  ["chest pain emergency", "emergency"],
  ["can I pay online", "faq"],
  ["can you explain my results", "faq"],
  ["what is the meaning of life", "unknown"],
];

describe("local engine — patient mode (40-question sample, SC-001 ≥ 90%)", () => {
  it("gets at least 90% of the sample right", () => {
    const misses = PATIENT_SET.filter(([q, intent, text]) => {
      const reply = ask(q);
      return reply.intent !== intent || (text !== undefined && !reply.text.includes(text));
    }).map(([q]) => `${q} -> ${ask(q).intent}`);
    expect(PATIENT_SET).toHaveLength(40);
    expect(misses.length, misses.join("\n")).toBeLessThanOrEqual(4);
  });

  it("answers only with data from the pack (doctor fee is the catalog fee)", () => {
    const ayesha = doctors.find((d) => d.fullName === "Dr. Ayesha Rahman");
    const reply = ask("Dr Ayesha Rahman fee");
    expect(reply.text).toContain(`PKR ${ayesha?.feePkr.toLocaleString("en-US")}`);
    expect(reply.links?.some((l) => l.href === `/book-appointment?doctor=${ayesha?.slug}`)).toBe(true);
  });

  it("never gives medical advice and always points to a doctor", () => {
    const reply = ask("my child has a cough, which tablet should I give?");
    expect(reply.intent).toBe("symptom");
    expect(reply.text).toMatch(/can't give medical advice/);
  });

  it("gives the emergency number from clinic settings", () => {
    expect(ask("emergency!").text).toContain(siteConfig.emergencyPhone.display);
  });

  it("refuses empty and over-long questions", () => {
    expect(ask("   ").intent).toBe("empty");
    expect(ask("x".repeat(MAX_QUESTION + 1)).intent).toBe("too_long");
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
    expect(Object.keys(pack.clinic).sort()).toEqual(["address", "emergencyPhone", "hours", "labHours", "name", "phone"]);
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
