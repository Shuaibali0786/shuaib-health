// Understanding loosely written Roman Urdu and English (Feature 013, owner test 2026-11-08). Free and local: no paid API.
//
// Patients type and speak the way they talk: "mujhy elaj karwana hia", "boking karo blod ki test", "kia aaj clenic off
// hia". Before anything is matched, every word is mapped to ONE canonical spelling (a closed list of variants and
// common typos), and a small fuzzy match catches one-letter slips in the key words ("bookimg", "appoitment").
// Only whole Latin words are touched: digits, emails ("share@gmail.com") and punctuation pass through unchanged,
// so a phone number or an email is never altered. Names are protected by the caller (no fuzzy match while a name
// is being asked).

import { cleanText } from "@/agent/normalize";

/** Canonical word -> the spellings and typos that mean it. */
const LEXICON: Record<string, string[]> = {
  mujhe: ["mujhy", "mujhay", "mjhe", "mujhai", "muje", "mujy", "mjy", "mje"],
  hai: ["hia", "hy", "hae", "haii", "he"],
  hain: ["hen", "hai n"],
  ilaaj: ["elaj", "ilaj", "ilaaj", "illaj", "elaaj", "ilaaaj", "eilaj", "treatment", "treatmnt", "tretment", "ilaaj"],
  karwana: ["karwana", "karwani", "karwane", "krwana", "krwani", "karvana", "karvani", "karana", "karani", "krana", "krani", "karwa", "krwa", "karwaana", "karwanay", "karnekiay", "karnekeliye", "karnekliye", "karnekelye", "karwanekiay", "karwanekeliye"],
  test: ["test", "tast", "tset", "teast", "testt", "tesst", "tst", "tes", "taste"],
  tests: ["testes", "tasts"],
  blood: ["blood", "blod", "bllod", "blud", "bloood", "bload", "blodd", "bluud", "khoon", "khun", "khoon", "khooni", "khuni", "khon"],
  booking: ["booking", "boking", "bookng", "bokking", "bukking", "buking", "bookin", "bookig", "bokng", "bkng"],
  book: ["bok", "buk"],
  appointment: ["apointment", "appoinment", "appointmnt", "apoitment", "appoitment", "apointmnt", "appontment", "appiontment", "apointement"],
  clinic: ["clenic", "clinik", "klinik", "clinc", "cilnic", "clnic", "clinick", "klinic", "kilinik"],
  kyun: ["kio", "kyu", "kyon", "kiyon", "kiun", "kiyun", "kiu", "q"],
  kya: ["kia", "kya", "kiya"],
  nahi: ["nahi", "nahin", "nai", "nhi", "nae", "nhn", "nahee"],
  haan: ["han", "haa", "haanji", "hanji", "hn"],
  doctor: ["docter", "dactor", "daktar", "doctr", "doc", "dakter", "doktor", "doctar"],
  timings: ["taiming", "timming", "timeing", "taimings"],
  aaj: ["aj", "aaj"],
  kal: ["kl"],
  parson: ["parso", "parsoon", "parsun"],
  band: ["off", "bund"],
  chutti: ["chhutti", "chuti", "chhuti", "holiday", "closed"],
  khula: ["khuli", "khulay", "khule", "khulla"],
  daant: ["dant", "dand", "daanth", "dantt"],
  bukhar: ["bukhaar", "bokhar", "bukar", "bkhar"],
  fee: ["fees", "fess", "fis", "fiss"],
  sakti: ["skti", "sakte", "skte", "sakta", "skta"],
  karo: ["kro", "karoo", "kardo", "krdo", "kar do", "kariye", "kijiye", "kijye", "karden", "kardein"],
  takleef: ["takleef", "taklif", "takleef", "takleif", "masla", "problem"],
  allergy: ["alergy", "allergi", "alergi", "elergy"],
  cancel: ["cancle", "cansel", "kansel"],
  yaar: ["yar", "yaara"],
  please: ["plz", "pls", "plzz", "plese"],
  hello: ["hay", "hy", "helo", "hellow", "hallo", "hii", "hi"],
};

// "he" is an English word, and "hy" is both "hai" and "hi": they stay as written (the language rules still see them).
const AMBIGUOUS = new Set(["he", "hy", "q", "hi", "doc", "taste", "closed", "holiday", "problem", "off"]);

/** Variants that only map when the turn is otherwise Roman Urdu or clinic talk (they are also English words). */
const VARIANTS = new Map<string, string>();
for (const [canonical, variants] of Object.entries(LEXICON)) {
  for (const v of variants) if (!v.includes(" ") && v !== canonical && !VARIANTS.has(v)) VARIANTS.set(v, canonical);
}

// Two-word spellings first ("karne ke liye" means "to get done").
const PHRASES: Array<[RegExp, string]> = [
  [/\bkarne\s+(?:ke|kay|k)\s+(?:liye|liay|liey|lie|lye)\b/gi, "karwana"],
  [/\bkarwane\s+(?:ke|kay|k)\s+(?:liye|liay|lie)\b/gi, "karwana"],
  [/\bkar\s+(?:do|dein|den|dijiye|dena)\b/gi, "karo"],
  [/\bat\s+the\s+rate\s+(?:of\s+)?/gi, "@"],
  [/\bnever\s+mind\b/gi, "nevermind"],
  [/\brehne\s+(?:do|den|dein)\b/gi, "rehne do"],
];

/** The key words a one-letter slip is corrected to. Short words are never fuzzy-matched. */
const FUZZY_TARGETS = ["booking", "appointment", "clinic", "doctor", "blood", "treatment", "karwana", "timings", "cancel", "bukhar", "allergy", "takleef"];

/** Optimal string alignment distance (a swap of two neighbours counts as one). */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      row[j] = Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j] as number, ((d[i - 2] as number[])[j - 2] as number) + 1);
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}

function fuzzy(word: string): string | null {
  if (word.length < 5) return null;
  for (const target of FUZZY_TARGETS) {
    // A plural or another form of the word is a different word ("bookings", "doctors"), not a typo.
    if (word === target || word[0] !== target[0] || word.startsWith(target)) continue;
    const allowed = target.length >= 8 ? 2 : 1;
    if (editDistance(word, target, allowed) <= allowed) return target === "treatment" ? "ilaaj" : target;
  }
  return null;
}

/**
 * The turn with every known spelling mapped to one canonical word. `fuzzy: false` turns off typo correction (while a
 * name is being asked, so "Bloom" stays a name).
 */
export function canonicalize(text: string, options: { fuzzy?: boolean } = {}): string {
  const useFuzzy = options.fuzzy !== false;
  let out = text;
  for (const [pattern, to] of PHRASES) out = out.replace(pattern, to);
  return out
    .split(/(\s+)/)
    .map((chunk) => {
      const m = /^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z@]*)$/.exec(chunk);
      if (!m) return chunk;
      const [, lead = "", core = "", tail = ""] = m;
      const lower = core.toLowerCase();
      if (AMBIGUOUS.has(lower)) return chunk;
      const mapped = VARIANTS.get(lower) ?? (useFuzzy ? fuzzy(lower) : null);
      return mapped ? `${lead}${mapped}${tail}` : chunk;
    })
    .join("");
}

// --- What a (canonical) turn is about ------------------------------------------------------------------

const has = (re: RegExp, text: string) => re.test(cleanText(text));

/** "Mujhe ilaaj karwana hai", "I need treatment": a request for care, with or without a named problem. */
export const asksTreatment = (text: string): boolean => has(/\bilaaj\b|\bcheck ?up karwana\b|\bdoctor ko dikhana\b|\bdikhana hai\b/, text);

/** "Test karwana hai", "I want a test": a test is wanted (which one may not be said yet). */
export const wantsTest = (text: string): boolean => has(/\btests?\b/, text) && has(/\b(karwana|chahiye|want|need|book|booking|karo|like|get)\b/, text);

/** "blood", "khoon" (canonical "blood"), but not blood pressure or a blood group. */
export const mentionsBlood = (text: string): boolean => has(/\bblood\b/, text) && !has(/\b(pressure|bp|group|sugar)\b/, text);

/** "Kya aaj clinic band hai?", "is the clinic open today?" */
export const asksOpenToday = (text: string): boolean => has(/\b(aaj|today|abhi|now|tonight)\b/, text) && has(/\b(clinic|open|khula|band|chutti|closed|off|hours|timings|khulta|khulti|lab)\b/, text);

/** "Booking kyun nahi kar rahi?", "I already told you": the caller is frustrated that nothing is happening. */
export const complains = (text: string): boolean =>
  has(/\b(kyun|why)\b.*\b(nahi|not|nahin)\b|\bbol raha\b|\bbol rahi\b|\bkeh raha\b|\bkeh rahi\b|\balready (told|said)\b|\bpehle hi\b|\bnot working\b|\bkaam nahi\b|\bsamajh nahi\b|\bsun nahi\b|\bjust (do|book) it\b|\btaking (forever|so long|too long)\b|\bhurry\b|\bjaldi karo\b|\bwhy (aren t|are not|isn t|is not) (you|it)\b|\bstill (not|waiting)\b/, text);

/** "Booking karo", "book kar sakti ho?", "appointment chahiye": the caller wants something booked. */
export const asksToBook = (text: string): boolean =>
  has(/\b(booking|book|appointment)\b/, text) && has(/\b(karo|kar|sakti|chahiye|please|want|need|can you|could you|karwana|book (me|my|an?|the|it|one))\b|^(booking|book|appointment)\b/, text);
