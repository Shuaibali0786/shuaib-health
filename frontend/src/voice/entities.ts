// Finds the doctor or department a caller means, from the public knowledge pack only (Feature 013).

import { cleanText, nameTokens } from "@/agent/normalize";
import { departmentForSymptoms } from "@/agent/localEngine";
import type { KnowledgePack } from "@/agent/types";

type PackDoctor = KnowledgePack["doctors"][number];

/** Two words are the same name when equal or when one is a clear prefix of the other ("ayesha" / "ayeshaa"). */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const short = Math.min(a.length, b.length);
  if (short < 4) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/** Doctors whose name words appear in the text; the best score only. Empty when none match. */
export function findDoctors(text: string, pack: KnowledgePack): PackDoctor[] {
  const words = cleanText(text).split(" ").filter((w) => w.length >= 3);
  let top = 0;
  let found: PackDoctor[] = [];
  for (const doctor of pack.doctors) {
    const names = nameTokens(doctor.name);
    const score = words.filter((w) => names.some((n) => same(w, n))).length;
    if (score === 0) continue;
    if (score > top) {
      top = score;
      found = [doctor];
    } else if (score === top) {
      found.push(doctor);
    }
  }
  return found;
}

// Everyday words that point at a department, by department slug.
const DEPARTMENT_WORDS: Record<string, string[]> = {
  dermatology: ["skin", "jild", "daane", "acne", "rash", "dermatologist", "allergy", "allergies", "khujli", "kharish", "itching"],
  dental: ["dental", "dentist", "teeth", "tooth", "daant", "dant"],
  cardiology: ["heart", "cardiologist", "dil"],
  pediatrics: ["child", "children", "kids", "kid", "baby", "bacha", "bachay", "bachi", "paediatric", "pediatrician"],
  gynecology: ["gynae", "gynaecologist", "gynecologist", "women", "lady", "pregnancy", "pregnant"],
  "general-medicine": ["general", "physician", "family", "fever", "bukhar", "flu", "zukam", "khansi", "cough", "checkup"],
};

/** The department slug a caller means (by name, everyday word or symptom), or null. The lab is never offered: lab tests are not booked here. */
export function findDepartment(text: string, pack: KnowledgePack, options: { symptoms?: boolean } = {}): string | null {
  const words = cleanText(text).split(" ").filter(Boolean);
  const bookable = pack.departments.filter((d) => pack.doctors.some((doc) => doc.departmentSlug === d.slug));
  for (const dept of bookable) {
    const names = [...nameTokens(dept.name), ...nameTokens(dept.slug)];
    if (words.some((w) => w.length >= 4 && names.some((n) => same(w, n)))) return dept.slug;
    if ((DEPARTMENT_WORDS[dept.slug] ?? []).some((k) => words.includes(k))) return dept.slug;
  }
  if (options.symptoms === false) return null;
  const bySymptom = departmentForSymptoms(text, pack);
  return bySymptom && bookable.some((d) => d.slug === bySymptom) ? bySymptom : null;
}

export function doctorsOf(department: string, pack: KnowledgePack): PackDoctor[] {
  return pack.doctors.filter((d) => d.departmentSlug === department);
}

/** Does the text name a lab test or package (so a "book" request is about a lab, not a doctor)? */
export function mentionsLabTest(text: string, pack: KnowledgePack): boolean {
  const clean = cleanText(text);
  if (/\b(lab|laboratory|pathology|blood test|sample|x ?ray|ultrasound|scan)\b/.test(clean)) return true;
  const words = clean.split(" ");
  return pack.labTests.some((t) => [t.name, ...t.aka].some((label) => nameTokens(label).filter((w) => w.length >= 3).some((w) => words.includes(w) && !["test", "blood", "complete", "count"].includes(w)))) || /\bcbc\b|\bhba1c\b|\bcholesterol\b|\btsh\b/.test(clean);
}

type PackLabTest = KnowledgePack["labTests"][number];

/** The lab test a caller names ("CBC", "thyroid test", "lipid profile"), from the public catalog only. */
export function findLabTest(text: string, pack: KnowledgePack): PackLabTest | null {
  const words = cleanText(text).split(" ").filter((w) => w.length >= 3 && !["test", "tests", "blood", "complete", "count", "profile", "karwana", "karwani", "karana"].includes(w));
  let top: { test: PackLabTest; score: number } | null = null;
  for (const test of pack.labTests) {
    const names = [test.name, test.slug, ...test.aka].flatMap((label) => nameTokens(label));
    const score = words.filter((w) => names.some((n) => same(w, n))).length;
    if (score > 0 && (!top || score > top.score)) top = { test, score };
  }
  return top?.test ?? null;
}

/** The department that does lab tests (the pathology lab) and its doctors, when the catalog has one. */
export function labDepartment(pack: KnowledgePack): { slug: string; name: string; doctors: PackDoctor[] } | null {
  const dept = pack.departments.find((d) => /lab|patholog/i.test(d.slug) || /lab|patholog/i.test(d.name));
  if (!dept) return null;
  return { slug: dept.slug, name: dept.name, doctors: doctorsOf(dept.slug, pack) };
}

/**
 * The lab test a caller means, including everyday words: "blood test", "blood ki", "khoon ka test" (canonical "blood")
 * mean the basic blood test, the CBC. A named test always wins. Null when no test is meant.
 */
export function resolveLabTest(text: string, pack: KnowledgePack): PackLabTest | null {
  const named = findLabTest(text, pack);
  if (named) return named;
  const clean = cleanText(text);
  if (!/\bblood\b/.test(clean) || /\b(pressure|bp|group|sugar|glucose)\b/.test(clean)) return null;
  return pack.labTests.find((t) => /complete-blood-count|\bcbc\b/i.test(`${t.slug} ${t.aka.join(" ")} ${t.name}`)) ?? null;
}

/** A lab test or a health package, both booked at the Pathology Lab; the card and the slip show its name and price. */
export type LabItem = { slug: string; name: string; pricePkr: number; kind: "test" | "package" };

export function labItem(pack: KnowledgePack, slug: string | null): LabItem | null {
  if (!slug) return null;
  const test = pack.labTests.find((t) => t.slug === slug);
  if (test) return { slug: test.slug, name: test.name, pricePkr: test.pricePkr, kind: "test" };
  const p = pack.packages.find((x) => x.slug === slug);
  return p ? { slug: p.slug, name: p.name, pricePkr: p.pricePkr, kind: "package" } : null;
}

type PackPackage = KnowledgePack["packages"][number];
const PACKAGE_GENERIC = new Set(["health", "check", "care", "package", "packages", "checkup", "the", "and", "s"]);
const PACKAGE_WORDS: Array<[RegExp, RegExp]> = [
  [/\b(senior|buzurg|budhe|old age|elderly|walid|walida|abbu|ammi)\b/, /senior/],
  [/\b(women|woman|ladies|aurat\w*|khawateen)\b/, /women/],
  [/\b(diabet\w*|sugar)\b/, /diabetes/],
  [/\b(heart|dil|cardiac)\b/, /heart/],
  [/\b(basic|full body|routine|general|complete)\b/, /basic/],
];

/** True when the patient talks about a health package or a full check-up. */
export const mentionsPackage = (text: string): boolean => /\b(package|packages|pakage|pkg|full body|full checkup|full check up|health check|health checkup|medical checkup)\b/.test(cleanText(text));

/** The package a patient names ("basic health check", "diabetes package", "senior citizen"), or null. */
export function findPackage(text: string, pack: KnowledgePack): PackPackage | null {
  const clean = cleanText(text);
  const words = clean.split(" ").filter((w) => w.length >= 3 && !PACKAGE_GENERIC.has(w));
  for (const p of pack.packages) {
    const names = nameTokens(p.name).filter((w) => !PACKAGE_GENERIC.has(w));
    if (names.length && (names.length >= 2 || mentionsPackage(clean)) && names.every((n) => words.some((w) => same(w, n)))) return p;
  }
  if (!mentionsPackage(clean)) return null;
  for (const [said, slug] of PACKAGE_WORDS) {
    if (said.test(clean)) {
      const found = pack.packages.find((p) => slug.test(p.slug));
      if (found) return found;
    }
  }
  return null;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_NAMES: Record<string, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

/** The clinic's weekday ("mon") and time ("14:05") right now, in the clinic's own time zone. */
export function clinicNow(pack: KnowledgePack, now: Date): { day: string; time: string; date: string } {
  const zone = pack.clinic.timeZone || "Asia/Karachi";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("weekday").slice(0, 3).toLowerCase(), time: `${get("hour")}:${get("minute")}`, date: `${get("year")}-${get("month")}-${get("day")}` };
}

/** The opening rule for a weekday, or null when the clinic is closed that day. Unknown hours count as open. */
export function openingOn(pack: KnowledgePack, day: string): { opens: string; closes: string } | null | undefined {
  const rules = pack.clinic.openingRules ?? [];
  if (rules.length === 0) return undefined;
  const rule = rules.find((r) => r.days.includes(day));
  return rule ? { opens: rule.opens, closes: rule.closes } : null;
}

/** True when the clinic is closed all day on this ISO date ("2026-11-08" is a Sunday). */
export function clinicClosedOn(pack: KnowledgePack, isoDate: string): boolean {
  const day = WEEKDAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()] as string;
  return openingOn(pack, day) === null;
}

export const dayName = (day: string): string => DAY_NAMES[day] ?? day;

/** The open weekdays, Monday first, as names ("Monday to Saturday" is built by the caller). */
export function openDayNames(pack: KnowledgePack): string[] {
  const open = new Set((pack.clinic.openingRules ?? []).flatMap((r) => r.days));
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter((d) => open.has(d)).map(dayName);
}
