// Text clean-up for the local engine: lower case, no accents or punctuation, a few common spellings and
// Roman Urdu words mapped to one English word, and stop words removed.

export const MAX_QUESTION = 300;

const SYNONYMS: Record<string, string> = {
  timing: "hours",
  timings: "hours",
  time: "hours",
  open: "hours",
  opening: "hours",
  close: "hours",
  closing: "hours",
  khulta: "hours",
  khulte: "hours",
  band: "hours",
  waqt: "hours",
  fees: "fee",
  charges: "fee",
  charge: "fee",
  price: "fee",
  prices: "fee",
  cost: "fee",
  costs: "fee",
  rate: "fee",
  rates: "fee",
  qeemat: "fee",
  kitni: "fee",
  kitna: "fee",
  paisay: "fee",
  doctors: "doctor",
  dr: "doctor",
  daktar: "doctor",
  specialist: "doctor",
  specialists: "doctor",
  consultant: "doctor",
  appointment: "book",
  appointments: "book",
  booking: "book",
  bookings: "book",
  appoint: "book",
  tests: "test",
  lab: "test",
  labs: "test",
  packages: "package",
  departments: "department",
  dept: "department",
  address: "location",
  where: "location",
  kahan: "location",
  directions: "location",
  phone: "contact",
  call: "contact",
  number: "contact",
  email: "contact",
  reports: "report",
  result: "report",
  results: "report",
  paediatrics: "pediatrics",
  paediatrician: "pediatrics",
  child: "pediatrics",
  children: "pediatrics",
  bachay: "pediatrics",
  skin: "dermatology",
  teeth: "dental",
  tooth: "dental",
  dentist: "dental",
  heart: "cardiology",
  cardiologist: "cardiology",
  women: "gynecology",
  gynaecology: "gynecology",
  gynae: "gynecology",
};

const STOP = new Set(
  "a an the is are am was be to of for in on at and or my me i you your we our it this that do does can could would please tell about what which who how much many with from any have has there kya hai hain ka ki ke ko se mein mujhe batao bataen bataye aap".split(" "),
);

export function cleanText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Meaningful words of a question, synonyms applied, stop words dropped, no duplicates. */
export function tokens(text: string): string[] {
  const words = cleanText(text)
    .split(" ")
    .filter(Boolean)
    .map((word) => SYNONYMS[word] ?? word)
    .filter((word) => !STOP.has(word));
  return [...new Set(words)];
}

/** Words of a name or label, for matching entities (no synonyms, so "Dr" does not become "doctor"). */
export function nameTokens(text: string): string[] {
  return cleanText(text)
    .split(" ")
    .filter((word) => word.length > 1 && word !== "dr" && !STOP.has(word));
}
