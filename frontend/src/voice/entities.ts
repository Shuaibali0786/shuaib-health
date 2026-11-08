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
  dermatology: ["skin", "jild", "daane", "acne", "rash", "dermatologist"],
  dental: ["dental", "dentist", "teeth", "tooth", "daant", "dant"],
  cardiology: ["heart", "cardiologist", "dil"],
  pediatrics: ["child", "children", "kids", "kid", "baby", "bacha", "bachay", "bachi", "paediatric", "pediatrician"],
  gynecology: ["gynae", "gynaecologist", "gynecologist", "women", "lady", "pregnancy", "pregnant"],
  "general-medicine": ["general", "physician", "family"],
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
