// What a patient's problem points to, from our own catalog only (Feature 013, owner test 2026-11-08).
//
// Patients say "bukhar hai", "skin pe daane", "daant ki safai", "BP high rehta hai", "bache ko khansi", in English or
// Roman Urdu, with typos. This maps the words (never a diagnosis, never a medicine) to a department that EXISTS in
// the knowledge pack and has doctors. Things the clinic does not offer (eyes, ears, bones, X-ray) are said honestly,
// with General Medicine as the place for a first check-up. Free and local: no paid API.

import { cleanText } from "@/agent/normalize";
import type { KnowledgePack } from "@/agent/types";

export type Problem =
  | { kind: "department"; slug: string; topic: string; topicRoman: string }
  | { kind: "not_offered"; topic: string; topicRoman: string; fallback: string | null; imaging: boolean };

type Rule = { slug: string; topic: string; topicRoman: string; words: RegExp };

// Order matters: the first rule that matches wins (a child first, then the more specific parts of the body).
const RULES: Rule[] = [
  {
    slug: "pediatrics",
    topic: "your child",
    topicRoman: "bachon",
    words: /\b(child|children|kid|kids|baby|babies|infant|toddler|son|daughter|bacha|bachay|bache|bachey|bachon|bachi|bachchi|bachcha|beta|beti|munna|munni|bachon ka doctor|paediatric\w*|pediatric\w*|child specialist)\b/,
  },
  {
    slug: "dental",
    topic: "teeth",
    topicRoman: "daant",
    words: /\b(daant|dant|daanth|danth|daanto|danto|daanton|teeth|tooth|toothache|dental|dentist|gum|gums|masoor\w*|cavity|keera|braces|scaling|root canal|filling|safai|jaw|daar)\b/,
  },
  {
    slug: "dermatology",
    topic: "skin or allergy",
    topicRoman: "jild ya allergy",
    words: /\b(skin|skn|jild|allergy|allergi|alergy|alergi|alerji|elergy|allergies|allergic|kharish|kharsh|khujli|khujlee|kharash|itch\w*|daane|dane|daney|pimples?|acne|keel|muhase|rash|rashes|eczema|chambal|baal gir\w*|hair ?fall|hair loss|dandruff|phunsi\w*|daag|spots?)\b/,
  },
  {
    slug: "gynecology",
    topic: "women's health",
    topicRoman: "khawateen ki sehat",
    words: /\b(pregnan\w*|haamla|hamla|hamal|periods?|mahwari|menstrual|lady doctor|gyna\w*|gyne\w*|women s health|delivery|ultrasound for pregnancy)\b/,
  },
  {
    slug: "cardiology",
    topic: "heart or blood pressure",
    topicRoman: "dil ya BP",
    words: /\b(bp|b p|blood pressure|high bp|low bp|hypertension|dil|heart|heartbeat|dhadkan|dharkan|palpitations?|cardio\w*)\b/,
  },
  {
    slug: "general-medicine",
    topic: "fever, cough or a general check-up",
    topicRoman: "bukhar, khansi ya aam check-up",
    words:
      /\b(fever|feverish|fevar|temperature|bukhar|bukhaar|bokhar|bukar|flu|zukam|zukaam|zukham|nazla|cold|sardi|khansi|khaansi|khasi|khaasi|cough|sore throat|throat|gala|gale|sar ?dard|sir ?dard|sar mein dard|sir mein dard|headache|migraine|pet ?dard|pait ?dard|pet mein dard|stomach\w*|tummy|ulti|ultiyan|vomit\w*|dast|diarrh\w*|loose motion\w*|kamzori|weakness|thakan|tired\w*|chakkar|dizz\w*|infection|typhoid|malaria|dengue|body ?pain|badan ?dard|jism ?dard|sugar|shugar|diabetes|diabetic|thyroid|checkup|check up|general physician|physician|ilaaj ka check)\b/,
  },
];

// Things this clinic does not have. Matched only when no rule above matched.
const NOT_OFFERED: Array<{ topic: string; topicRoman: string; words: RegExp; imaging?: boolean }> = [
  { topic: "eye care", topicRoman: "aankhon ka ilaaj", words: /\b(aankh\w*|ankh\w*|eyes?|nazar|vision|chashma|glasses|eye doctor|ophthalm\w*)\b/ },
  { topic: "ear, nose and throat care", topicRoman: "kaan, naak aur gale ka ilaaj", words: /\b(kaan|kan dard|ears?|ent|naak|nose|sinus)\b/ },
  { topic: "bones and joints", topicRoman: "haddiyon aur joron ka ilaaj", words: /\b(haddi\w*|bones?|joints?|joron|jodon|ghutn\w*|knee\w*|kamar ?dard|back ?pain|fracture|ortho\w*|arthritis)\b/ },
  { topic: "X-ray and scans", topicRoman: "X-ray aur scan", words: /\b(x ?ray|xray|ultrasound|scan|mri|ct ?scan|ecg|echo)\b/, imaging: true },
];

const bookable = (pack: KnowledgePack, slug: string) => pack.departments.some((d) => d.slug === slug) && pack.doctors.some((d) => d.departmentSlug === slug);

/**
 * The problem the patient describes, mapped to a department we really have, or to an honest "we don't offer that".
 * Null when no problem is described. Emergencies are handled before this (the safety guards run first).
 */
export function findProblem(text: string, pack: KnowledgePack): Problem | null {
  const clean = cleanText(text);
  if (!clean) return null;
  const child = RULES[0] as Rule;
  for (const rule of RULES) {
    if (!rule.words.test(clean)) continue;
    // "Bache ke daant" is still the dentist; a child with anything else goes to the children's doctors.
    if (rule === child) {
      const dentalRule = RULES[1] as Rule;
      if (dentalRule.words.test(clean) && bookable(pack, "dental")) return { kind: "department", slug: "dental", topic: dentalRule.topic, topicRoman: dentalRule.topicRoman };
    }
    if (bookable(pack, rule.slug)) return { kind: "department", slug: rule.slug, topic: rule.topic, topicRoman: rule.topicRoman };
    if (bookable(pack, "general-medicine")) return { kind: "department", slug: "general-medicine", topic: rule.topic, topicRoman: rule.topicRoman };
    return null;
  }
  for (const item of NOT_OFFERED) {
    if (item.words.test(clean)) {
      return { kind: "not_offered", topic: item.topic, topicRoman: item.topicRoman, fallback: bookable(pack, "general-medicine") ? "general-medicine" : null, imaging: Boolean(item.imaging) };
    }
  }
  return null;
}

/** The department a problem points to (null for "not offered" and no problem). */
export const problemDepartment = (text: string, pack: KnowledgePack): string | null => {
  const p = findProblem(text, pack);
  return p?.kind === "department" ? p.slug : null;
};
