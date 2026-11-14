// Names, emails and reasons said aloud (Feature 013). Free text is never trusted: the same rules as the
// website form apply (letters only for a name, an email shape, at most 300 characters for a reason).

const NAME_CHARS = /^[\p{L}\p{M} .'’-]+$/u;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FILLER_WORDS = new Set("ji jee haan han yes yeah sure okay ok so um uh well hello hi salam assalam alaikum aoa please plz sir madam mera meri naam name is my i am im main hoon hun hai from this".split(" "));
const TRAILING = /\s+(hai|hoon|hun|hain|please|plz|sir|madam|bol raha hoon|bol rahi hoon|speaking)\s*$/i;

const titleCase = (s: string) => s.replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());

/** The name, checked with the website rule, or null. */
export function cleanName(raw: string): string | null {
  const name = titleCase(raw.trim().replace(/\s+/g, " ").replace(/[,.!?]+$/g, ""));
  return name.length >= 2 && name.length <= 80 && NAME_CHARS.test(name) && /\p{L}{2}/u.test(name) ? name : null;
}

// Words that mean the candidate is a sentence, not a name ("I am looking for a doctor", "main kal aaunga").
const NOT_A_NAME = new Set(
  "looking here calling trying fine good great sick ill not having feeling going want need needs interested patient new old a an the for to with from in at on doctor dr appointment booking book please ok okay sure yes no and my is am are was ke ki ka ko se mein jana jaana chahta chahti hoon aaunga aaungi bimar bimaar theek kal aaj abhi bohat bahut dard bukhar aana aani lena leni milna milni hai hain kar karna karni dikhana dikhani aap aapko apko aapse ap tum tumhe tumko main hum yaar yar bol raha rahi rahe keh kyun kyon kyu nahi nahin kya booking boking test blood khoon ilaaj elaj clinic chahiye karo karwana karwani sakti sakte".split(" "),
);

const INTROS: RegExp[] = [
  /(?:my name is|my name's|name is|this is|i am|i'm|im)\s+([^,.;!?]+)/i,
  /(?:mera naam|meraa naam|mera name|apna naam)\s+([^,.;!?]+?)(?:\s+(?:hai|hy|he))?\s*(?:[,.;!?]|$)/i,
  /\bmain\s+([^,.;!?]+?)\s+(?:hoon|hun|bol raha hoon|bol rahi hoon)\b/i,
];

// Words that can be part of a real name when the name was just asked ("Ali Test", "Sana Clinic" is odd but possible):
// they stop a name only in an unasked sentence ("blood test karwana hai").
const TOPIC_WORDS = new Set("test blood khoon clinic patient new old".split(" "));

// Never a name, in any mode (owner test 2026-11-09: "spelling sahi hai", heard as "Aspilng sahi hai", was saved as the
// name "Aspilng Sahi"): yes / no words and "spelling" as the recogniser mishears it.
const NEVER_NAME = new Set("sahi theek thik teek yes yeah yep haan han ji jee ok okay correct right wrong galat ghalat nahi nahin no bilkul perfect done confirm".split(" "));
const SPELLING = /^[aie]?s+[bp]+[ei]+l+[ei]*n*g*$/;
// "Hmm", "umm", "uh", "er": a pause, never a name ("Nice to meet you, Hmm" was a real result).
const HESITATION = /^(h+m+|m+h*m+|u+m+|u+h+|e+r+m*|a+h+|o+h+|h+u+h+|a+c+h+a+)$/;

const looksLikeName = (candidate: string, asked = false): boolean => {
  const words = candidate.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return false;
  if (words.some((w) => NEVER_NAME.has(w) || SPELLING.test(w) || HESITATION.test(w))) return false;
  return !words.some((w) => NOT_A_NAME.has(w) && !(asked && TOPIC_WORDS.has(w)));
};

/**
 * A name from one utterance. With `asked` (the caller was just asked for their name) a bare answer such as
 * "Ali Raza" is accepted; otherwise only an introduction ("my name is …", "mera naam … hai") counts.
 */
export function extractName(text: string, asked: boolean): string | null {
  for (const pattern of INTROS) {
    const found = pattern.exec(text);
    if (!found?.[1]) continue;
    const name = cleanName(found[1].replace(TRAILING, ""));
    if (name && looksLikeName(name, asked)) return name;
  }
  if (!asked) return null;
  const words = text.trim().replace(/[,.!?]+/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  if (kept.length === 0 || kept.length > 4) return null;
  const name = cleanName(kept.join(" "));
  return name && looksLikeName(name, true) ? name : null;
}

/**
 * The patient confirms the spelling of their name ("haan", "yes", "sahi hai", "spelling sahi hai", heard as "Aspilng sahi
 * hai", "theek hai", "correct", "that's right"): any yes word and no "no" or "wrong".
 */
export function confirmsSpelling(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  if (words.some((w) => /^(no|nahi|nahin|nope|galat|ghalat|wrong|incorrect|not|change|badal|badlo)$/.test(w))) return false;
  return words.some((w) => /^(yes|yeah|yep|yup|haan|han|ji|jee|sahi|theek|thik|teek|correct|right|ok|okay|bilkul|perfect|exactly|sure)$/.test(w));
}

const DIGIT_WORD: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };

// Words around a spoken email that are not part of it ("my email is …", "mera email … hai", "Suhail ka email gmail").
const EMAIL_FILLER = new Set("my mine your email emails e-mail emailid address id is it's its it s mera meri mere ka ki ke hai he hain hy please plz ji jee yeh ye wo woh sir madam okay ok likh lein lo likho note kar karein kar lein this that shukriya thanks thank you".split(" "));
// Free mail providers a patient names without "at" or ".com" ("Sohail gmail dot com", "sohail khan at gmail").
const PROVIDERS = "gmail|yahoo|hotmail|outlook|icloud|live|ymail|aol|protonmail|proton";

/**
 * An email said aloud ("ali dot raza at gmail dot com", "at the rate", "Sohail gmail dot com", "sohail khan at
 * gmail"), or typed. Null when it has no email shape. With `asked` (the email question is open) a missing "at" or
 * ".com" after a known provider is filled in; otherwise only a full spoken or typed email counts.
 */
export function extractEmail(text: string, asked = false): string | null {
  const typed = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(text);
  if (typed && EMAIL_SHAPE.test(typed[0].replace(/[,;.]+$/, ""))) return typed[0].replace(/[,;.]+$/, "").toLowerCase();
  const words = text
    .toLowerCase()
    .replace(/[?!,;:"“”]+/g, " ")
    .replace(/\b(at the rate( of)?|at rate|attherate|at d rate)\b/g, " @ ")
    .replace(/\bat\b/g, " @ ")
    .replace(/\b(dot|daat|dat|point)\b/g, " . ")
    .replace(/\b(underscore|under score)\b/g, " _ ")
    .replace(/\b(dash|hyphen|minus)\b/g, " - ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !EMAIL_FILLER.has(w))
    .map((w) => DIGIT_WORD[w] ?? w);
  let spoken = words.join("").replace(/\.+$/, "");
  if (asked && words.length <= 10) {
    // "sohailgmail.com" -> "sohail@gmail.com"; "sohail@gmail" -> "sohail@gmail.com".
    if (!spoken.includes("@")) spoken = spoken.replace(new RegExp(`^([a-z0-9._%+-]{2,})(${PROVIDERS})((?:\\.[a-z]{2,})*)$`), "$1@$2$3");
    spoken = spoken.replace(new RegExp(`@(${PROVIDERS})$`), "@$1.com");
  }
  const found = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.exec(spoken);
  return found && EMAIL_SHAPE.test(found[0]) && found[0].length <= 254 ? found[0] : null;
}

/** "sohail@gmail.com" -> "s-o-h-a-i-l at gmail dot com" (shown) or "s, o, h, a, i, l, at gmail dot com" (spoken). */
export function spellEmail(email: string, spoken = false): string {
  const [local = "", domain = ""] = email.split("@");
  // "ali.raza" -> "a-l-i dot r-a-z-a": each part spelled, the separators said as words.
  const parts = local.split(/([._-])/).filter(Boolean);
  const word = (sep: string) => (sep === "." ? "dot" : sep === "_" ? "underscore" : "dash");
  const name = parts.map((part) => (/^[._-]$/.test(part) ? word(part) : spoken ? `${[...part].join(", ")},` : [...part].join("-"))).join(" ");
  return `${name} at ${domain.replace(/\./g, " dot ")}`;
}

const SKIP = /^(?:no|nahi|nahin|skip|none|nothing|no email|email nahi|koi nahi|nahi hai|i don'?t have|dont have|don'?t have one|not now|baad mein|rehne do|chhor do|chor do)\b/i;

/** True when the caller declines an optional question ("skip", "nahi", "no email"). */
export const declines = (text: string): boolean => SKIP.test(text.trim());

/** The reason for the visit: the caller's own words, trimmed to the website limit. */
export function cleanReason(text: string): string | null {
  const reason = text.trim().replace(/\s+/g, " ").slice(0, 300);
  return reason.length >= 2 ? reason : null;
}
