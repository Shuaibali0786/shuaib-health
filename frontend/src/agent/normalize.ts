// Text clean-up for the local engine: lower case, no accents or punctuation, a few common spellings and
// Roman Urdu words mapped to one English word, and stop words removed (v1.1 adds more Roman Urdu).

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
  khulti: "hours",
  khulte: "hours",
  band: "hours",
  waqt: "hours",
  schedule: "hours",
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
  kitne: "fee",
  paisay: "fee",
  paise: "fee",
  doctors: "doctor",
  dr: "doctor",
  daktar: "doctor",
  doctr: "doctor",
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
  kidhar: "location",
  directions: "location",
  located: "location",
  phone: "contact",
  call: "contact",
  number: "contact",
  email: "contact",
  reports: "report",
  result: "report",
  results: "report",
  kab: "when",
  paediatrics: "pediatrics",
  paediatrician: "pediatrics",
  pediatrician: "pediatrics",
  child: "pediatrics",
  children: "pediatrics",
  bachay: "pediatrics",
  bachon: "pediatrics",
  skin: "dermatology",
  teeth: "dental",
  tooth: "dental",
  dentist: "dental",
  heart: "cardiology",
  cardiologist: "cardiology",
  women: "gynecology",
  gynaecology: "gynecology",
  gynae: "gynecology",
  ghar: "home",
  collection: "sample",
};

const STOP = new Set(
  (
    "a an the is are am was be to of for in on at and or my me i you your we our it this that do does can could would please tell about what which who how much many with from any have has there " +
    "kya hai hain ka ki ke ko se mein mujhe batao bataen bataye bataiye aap ap ji sahab hamein humein mera meri mere chahiye karna krna karein lein le liye sakta sakti sakte hota hoti hoga hogi wala wali"
  ).split(" "),
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

/** The question's own words without synonyms (so "women" stays "women"), stop words dropped. */
export function rawWords(text: string): string[] {
  return [...new Set(cleanText(text).split(" ").filter((word) => word && !STOP.has(word)))];
}

/** Words of a name or label, for matching entities (no synonyms, so "Dr" does not become "doctor"). */
export function nameTokens(text: string): string[] {
  return cleanText(text)
    .split(" ")
    .filter((word) => word.length > 1 && word !== "dr" && !STOP.has(word));
}

// --- Language style (v1.1): reply in English or in simple Roman Urdu, like the person wrote. ----------

export type Lang = "en" | "roman";

// Words that are Urdu written in Latin letters and are not ordinary English words.
const ROMAN_MARKERS = new Set(
  (
    "hai hain kya kitni kitna kitne kab kahan kidhar kaise kaun mujhe chahiye karna krna karein batao bataen bataye bataiye nahi nahin theek thik shukriya shukria " +
    "salam salaam assalam asalam assalamualaikum assalamoalaikum walaikumassalam aoa walaikum alaikum aur dhoondein chunein bhai ji sahab mera meri mere hamein humein liye sakta sakti hota hoti milegi milega milay ghar daant dant pet dard bukhar " +
    "khansi khujli kharish ulti dast zukam chakkar kamzori bacha bachay bachi bachey bachon aaj kal subah sham raat waqt qeemat paisay khulta khulti band karwana karwani " +
    "dikhana dikhani hafiz khuda allah aap ap karo kardo kar ki ka ke ko yaar kyun kyon raha rahi rahe ilaaj takleef sakti sakte karwa"
  ).split(" "),
);
// Letters used in Urdu but not in Arabic (ٹ ڈ ڑ ں ھ ے ی ک گ پ چ ژ).
const URDU_LETTERS = /[ٹڈڑںھےیکگپچژ]/;

export function detectLang(text: string): Lang {
  if (URDU_LETTERS.test(text)) return "roman";
  const words = cleanText(text).split(" ");
  return words.some((word) => ROMAN_MARKERS.has(word)) ? "roman" : "en";
}
