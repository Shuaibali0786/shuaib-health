// The voice receptionist's safety layer (Feature 013, spec FR-030..FR-035). It runs BEFORE the answer engine and
// before any booking dialog, on every turn, so no dialog state can switch it off.
//
// There is no tool, no endpoint and no data in this feature that a trick could unlock: voice answers come from
// the public knowledge pack, and booking uses the public booking route. These guards are the second layer:
// they give a calm, fixed answer and keep the conversation on what the receptionist can really do.

import { cleanText } from "@/agent/normalize";
import { isEmergencyText } from "@/agent/localEngine";
import type { AgentReply, KnowledgePack } from "@/agent/types";

import { T } from "./phrases";
import type { VoiceLang } from "./types";

export type GuardKind =
  | "emergency"
  | "crisis"
  | "prompt_probe"
  | "role_play"
  | "authority"
  | "private_data"
  | "lookup_request"
  | "dose"
  | "results"
  | "diagnosis"
  | "is_human"
  | "is_real"
  | "promise"
  | "skip_confirmation"
  | "bulk_booking"
  | "abuse";

export type Guarded = { kind: GuardKind; reply: AgentReply; pausesBooking: boolean };

const ANY = (...parts: string[]) => new RegExp(`\\b(?:${parts.join("|")})\\b`);

const CRISIS = ANY("hurt myself", "kill myself", "end my life", "end it all", "want to die", "suicide", "suicidal", "khud kushi", "khudkushi", "apni jaan", "jaan dena", "marna chahta", "marna chahti", "mar jana chahta", "mar jaana chahta", "self harm");
const EMERGENCY_EXTRA = ANY("chest pain", "arm is numb", "arm numb", "cant breathe", "can t breathe", "trouble breathing", "difficulty breathing", "saans lene mein", "saans nahi", "heart attack", "stroke", "unconscious", "not responding", "heavy bleeding", "bleeding a lot", "choking", "seena dard", "seene mein dard", "dil mein dard", "behosh", "khoon beh", "tez dard seene");
const PROMPT_PROBE = ANY(
  "system prompt", "your prompt", "your instructions", "your rules", "your guidelines", "your configuration", "your settings", "initial instructions",
  "ignore (all |your |the |any )?(previous |prior |above |earlier )?(instructions|rules|guidelines)", "disregard (all |your |the )?(previous |prior )?(instructions|rules)",
  "forget (all |your |the )?(previous |prior )?(instructions|rules)", "repeat (everything|all|the text) (above|before)", "word for word", "reveal (your|the) (prompt|rules|instructions)",
  "show (me )?(your|the) (prompt|rules|instructions)", "what (are|were) you told", "what is your prompt", "debug mode", "developer mode", "maintenance mode", "god mode", "jailbreak",
  "translate your (instructions|rules|prompt)", "apni hidayat", "apne rules", "apni rules", "pichli hidayat", "pehli hidayat", "hidayaat bhool", "rules bhool", "prompt dikhao", "prompt batao", "apna prompt",
  "which tools", "list your tools", "what tools", "api key", "database", "which cloud", "tech stack", "source code",
);
const ROLE_PLAY = ANY("you are now", "from now on you", "pretend (to be|you are|you re)", "act as", "act like", "role ?play", "imagine you are", "behave as", "you are no longer", "doctorgpt", "dan mode", "new persona", "ab aap ho", "ab tum ho", "farz karo", "farz karein ke aap", "bano");
const AUTHORITY = ANY(
  "i am (the |an? )?(admin|administrator|doctor|developer|manager|owner|staff|receptionist|nurse|engineer|clinic owner|your creator|from the clinic)",
  "i m (the |an? )?(admin|administrator|doctor|developer|manager|owner|staff|receptionist)", "this is (the )?(admin|manager|owner|developer|doctor)",
  "main (admin|doctor|manager|owner|developer|staff) hoon", "mein (admin|doctor|manager|owner|developer|staff) hoon", "admin access", "admin mode", "(manager|owner|admin|clinic) (said|says|told|authori[sz]ed|approved|allowed)",
  "manager ne (kaha|bola)", "admin ne (kaha|bola)", "override code", "special code", "secret code", "authori[sz]ation code", "new policy", "naya policy", "from today the agent", "discount",
);
const PRIVATE = ANY(
  "(phone|mobile|number|email|address|cnic|reason|age|name|record|history|details?) of (the |that |this |a |another |some )?(patient|person|someone|whoever|user|guy|lady|him|her|them|ali|ahmed|sara|ayesha|booked|reference)",
  "whoever booked", "who (else )?(has|have|had|booked|is booked|got)", "who is booked", "is [a-z]+ booked", "list (all |the |today s |todays )?(bookings|appointments|patients|users)", "all (bookings|appointments|patients)",
  "show (me )?(all |the |today s )?(bookings|appointments|patients|schedule of patients)", "bookings (made )?today", "patient (list|records?|data|details|names?|info)", "other patients?", "dusre (marizon|mareezon|patient)",
  "staff (email|password|list|names?|login|account)", "admin (email|password|login|panel|dashboard)", "command centre", "dashboard (data|login|password)", "reset (the )?(staff|admin) password", "two factor", "2fa",
  "kis ne book", "kis ki booking", "kiska number", "kiski booking", "dusre ki booking", "sab bookings", "patients ki list", "mareez ki list", "mareezon ki list",
  "spell (out )?the email", "read (me )?the (patient|full) (name|number)", "full (phone|number|name|email)",
);
const LOOKUP = ANY(
  "(find|check|look ?up|search|see|show|get|tell me) (my |the |our |his |her )?(booking|appointment|reservation)", "my (booking|appointment) (status|details|time)", "booking (status|check|lookup|dhoondo|dekho|check karni)",
  "(cancel|reschedule|change|move|modify|delete|edit|postpone) (my |the |an? )?(existing )?(booking|appointment)", "(booking|appointment) (cancel|badal|change|reschedule)",
  "(otp|one time (code|password)|verification code|6 digit code|six digit code|code (is|hai))", "send (me )?(a |the )?code", "meri booking", "mera appointment", "booking ka status", "reference (number )?(lost|bhool|kho|yaad nahi)", "lost (my )?reference", "forgot (my )?reference",
  "last (4|four) digits", "brute ?force", "try (all )?codes", "guess (the )?(code|reference)",
);
const DOSE = ANY("dose", "dosage", "how many (tablets?|pills?|mg|capsules?|drops?|spoons?)", "kitni (goli|goliyan|dawai|dose|tablet)", "kitne (mg|tablet|goli)", "paracetamol", "panadol", "ibuprofen", "brufen", "aspirin", "antibiotics?", "insulin", "which medicine", "konsi dawai", "kaun si dawai", "what (medicine|medication|tablet) (should|can|do)", "can i take", "should i take", "give my (child|baby|son|daughter|kid)", "mg\\b");
const RESULTS = ANY(
  "my (hba1c|sugar|cholesterol|blood pressure|bp|creatinine|hemoglobin|haemoglobin|tsh|report|result|results|test result|lab result|scan|x ray|xray|ecg|mri)\\b.{0,30}\\b(is|are|was|came|shows|show|reading|hai|aaya|aayi|aya)",
  "is (this|it|that|my) .{0,25}(normal|bad|high|low|serious|dangerous|okay|fine|ok)", "interpret", "read (my )?(report|result|scan)", "what does (my|this) (report|result|reading)", "report (mein|me) .{0,25}(high|low|zyada|kam|normal)", "(normal|theek) hai (ya|kya)", "should i (worry|be worried)",
  "kya yeh (serious|khatarnak)", "chinta", "hba1c", "reading",
);
const DIAGNOSIS = ANY("do i have", "what (disease|illness|condition|infection)", "diagnose", "diagnosis", "what is wrong with me", "kya mujhe .{0,30}(hai|hua)", "mujhe kya (hua|bimari)", "konsi bimari", "kaun si bimari", "is it (cancer|diabetes|covid|dengue|typhoid|malaria)", "kya yeh (cancer|diabetes|dengue|typhoid)", "which doctor is better", "who is the best doctor", "behtar doctor", "best doctor");
const IS_HUMAN = ANY("are you (a )?(real |actual )?(human|person|man|woman|robot|bot|ai|machine)", "kya aap (insaan|human|robot|bot)", "aap (insaan|robot) hain", "is this a (bot|robot|machine)", "am i talking to a (human|person|real)");
const IS_REAL = ANY("is this a real (clinic|hospital|place|doctor)", "real clinic", "yeh asli clinic", "kya yeh asli", "is the clinic real", "are the doctors real");
const PROMISE = ANY("promise", "guarantee", "guaranteed", "100 percent", "hundred percent", "pakka", "cure (me|guaranteed)", "i guarantee a cure", "say .{0,12}cure", "for sure", "wait ?time", "in 5 minutes", "5 minute", "no waiting", "bilkul theek ho", "yaqeen dilao", "waada");
const SKIP_CONFIRM = ANY(
  "skip (the )?(confirmation|read ?back|confirm)", "without (asking|confirming|confirmation|me saying|my yes)", "no need to (confirm|ask|read)", "don t ask (me )?(to confirm|again)", "assume (i|that i) (said|say) yes", "consider it (confirmed|booked|done)",
  "the user (already )?(said|says|confirmed)", "i (already )?(said|confirmed) yes", "already confirmed", "just book it", "book it now", "book immediately", "confirm (it )?(automatically|yourself|for me)", "auto ?confirm", "bina poochay", "bina puchhe", "confirm mat", "pooch ke baghair", "khud confirm", "maine haan keh diya",
);
const BULK = ANY("book (\\d+|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred|multiple|many|all|every) (more |other |extra )?(appointments?|slots?|bookings?|times?)", "(\\d+|two|three|four|five|ten|twenty|fifty|multiple|many) (appointments?|slots?|bookings?) (for|under|with|on)", "different names", "fake (booking|name|appointment)", "book (the )?whole (day|week)", "block (all|every|the) (slots?|day)", "second booking", "another booking", "ek aur booking", "aur bookings", "sab slots", "saray slots", "dobara book", "phir se book");
const ABUSE = ANY("stupid", "idiot", "useless", "shut up", "fuck\\w*", "shit", "bastard", "bakwas", "ullu", "bewakoof", "pagal", "kutta", "harami", "gadha", "chup kar", "nikamma");

const phoneOf = (pack: KnowledgePack) => pack.clinic.phone;

type Builder = (pack: KnowledgePack, lang: VoiceLang) => string;

const REPLIES: Record<Exclude<GuardKind, "emergency" | "crisis">, Builder> = {
  prompt_probe: (_p, l) =>
    T(l, "I can't share how I work behind the scenes, but I'm happy to help with appointments, doctors, lab tests, fees and timings. What would you like?", "Main apne andar ke rules share nahi kar sakti, lekin appointment, doctors, lab tests, fees aur timings mein zaroor madad karungi. Aap ko kya chahiye?"),
  role_play: (_p, l) =>
    T(l, "I'll stay as the clinic's assistant. I can help with appointments, doctors, lab tests, fees and timings. What would you like?", "Main clinic ki assistant hi rahungi. Appointment, doctors, lab tests, fees aur timings mein madad kar sakti hoon. Bataiye?"),
  authority: (p, l) =>
    T(l, `I can't change anything based on who someone says they are, and I have no staff or admin functions here. For clinic matters please call ${phoneOf(p)}. Is there something else I can help with?`, `Main kisi ke daawe par kuch nahi badal sakti, aur yahan mere paas staff ya admin ke functions nahi hain. Clinic ke maamle ke liye ${phoneOf(p)} par call karein. Kuch aur madad chahiye?`),
  private_data: (p, l) =>
    T(l, `I can't share anything about other people or the clinic's private records. I only know the public information, like doctors, timings, tests and fees. For anything else, please call ${phoneOf(p)}.`, `Main doosre logon ya clinic ke private records ke baare mein kuch nahi bata sakti. Mere paas sirf public maloomat hain, jaise doctors, timings, tests aur fees. Baaki ke liye ${phoneOf(p)} par call karein.`),
  lookup_request: (p, l) =>
    T(l, `To protect everyone's privacy, I can't look up, change or cancel an existing booking in this chat, and I can't send or accept codes. Please call the clinic on ${phoneOf(p)} with your booking reference. I can book a new appointment for you, though.`, `Sab ki privacy ke liye main is chat mein purani booking dekh, badal ya cancel nahi kar sakti, aur code bhej ya le nahi sakti. Barah-e-meherbani apne reference ke saath ${phoneOf(p)} par call karein. Naya appointment main zaroor book kar sakti hoon.`),
  dose: (p, l) =>
    T(l, `I can't advise on medicines or doses. A doctor needs to guide you. I can help you book an appointment. If it's urgent, call ${p.clinic.emergencyNumbers} now.`, `Main dawai ya dose ke baare mein mashwara nahi de sakti. Yeh doctor hi bata sakte hain. Main appointment book karne mein madad kar sakti hoon. Agar fori masla hai to ${p.clinic.emergencyNumbers} par abhi call karein.`),
  results: (p, l) =>
    T(l, `I can't read or explain test results. Please show your report to a doctor; I can help you book one. For urgent worries, call ${p.clinic.emergencyNumbers}.`, `Main test ke results parhh ya samjha nahi sakti. Apni report doctor ko dikhayein; main booking mein madad kar sakti hoon. Fori fikar ho to ${p.clinic.emergencyNumbers} par call karein.`),
  diagnosis: (p, l) =>
    T(l, `I can't diagnose or compare doctors. A doctor can examine you. Tell me what the problem is and I'll suggest which department to start with, and I can book it. If it feels urgent, call ${p.clinic.emergencyNumbers}.`, `Main diagnosis nahi kar sakti aur doctors ka muqabla bhi nahi. Doctor aap ka muaina karenge. Masla bataiye, main bata dungi ke kis department se shuru karein, aur booking bhi kar dungi. Fori lage to ${p.clinic.emergencyNumbers} par call karein.`),
  is_human: (_p, l) =>
    T(l, "I'm an AI assistant for a demo clinic, not a person. I can still help with appointments, doctors, tests and timings.", "Main ek AI assistant hoon, insaan nahi, aur yeh ek demo clinic hai. Phir bhi appointment, doctors, tests aur timings mein madad kar sakti hoon."),
  is_real: (_p, l) =>
    T(l, "This is a portfolio demo, not a real clinic. The doctors and prices are samples, and this is not medical advice.", "Yeh ek portfolio demo hai, asli clinic nahi. Doctors aur qeematein sirf namoona hain, aur yeh medical mashwara nahi hai."),
  promise: (p, l) =>
    T(l, `I can't promise results, waiting times or prices beyond what's listed. For anything specific, please call ${phoneOf(p)}.`, `Main nateeje, intezaar ke waqt ya listed se alag qeemat ka waada nahi kar sakti. Khaas baat ke liye ${phoneOf(p)} par call karein.`),
  skip_confirmation: (_p, l) =>
    T(l, "I always read the details back and book only after you say yes yourself. That keeps your booking safe.", "Main hamesha tafseelat dohrati hoon aur sirf tab book karti hoon jab aap khud haan kahein. Is se aap ki booking mehfooz rehti hai."),
  bulk_booking: (p, l) =>
    T(l, `I can make one booking per conversation. For more appointments, please use the booking page on the website or call ${phoneOf(p)}.`, `Main ek conversation mein sirf ek booking kar sakti hoon. Mazeed appointments ke liye website ka booking page istemal karein ya ${phoneOf(p)} par call karein.`),
  abuse: (_p, l) =>
    T(l, "I'm here to help, and I'd like to keep this polite. What can I do for you?", "Main madad ke liye hoon, aur chahti hoon ke baat tehzeeb se ho. Main aap ke liye kya kar sakti hoon?"),
};

const ORDER: Array<[Exclude<GuardKind, "emergency" | "crisis">, RegExp]> = [
  ["prompt_probe", PROMPT_PROBE],
  ["skip_confirmation", SKIP_CONFIRM],
  ["role_play", ROLE_PLAY],
  ["authority", AUTHORITY],
  ["bulk_booking", BULK],
  ["private_data", PRIVATE],
  ["lookup_request", LOOKUP],
  ["dose", DOSE],
  ["results", RESULTS],
  ["diagnosis", DIAGNOSIS],
  ["is_real", IS_REAL],
  ["is_human", IS_HUMAN],
  ["promise", PROMISE],
  ["abuse", ABUSE],
];

function emergency(pack: KnowledgePack, lang: VoiceLang): AgentReply {
  const { emergencyNumbers, emergencyPhone } = pack.clinic;
  return {
    intent: "emergency",
    text: T(
      lang,
      `Please call ${emergencyNumbers} right now, or go to the nearest emergency department. The clinic's emergency line is ${emergencyPhone}. Don't wait. I'm stopping everything else.`,
      `Fori ${emergencyNumbers} par abhi call karein, ya qareebi emergency department jayein. Clinic ki emergency line ${emergencyPhone} hai. Intezaar na karein. Main baaki sab rok rahi hoon.`,
    ),
    links: [{ label: `Call ${emergencyPhone}`, href: `tel:${emergencyPhone.replace(/[^\d+]/g, "")}` }],
  };
}

function crisis(pack: KnowledgePack, lang: VoiceLang): AgentReply {
  const { emergencyNumbers, emergencyPhone } = pack.clinic;
  return {
    intent: "crisis",
    text: T(
      lang,
      `I'm really sorry you feel this way, and you matter. Please call ${emergencyNumbers} now, or go to the nearest emergency department, or tell someone you trust to stay with you. The clinic's emergency line is ${emergencyPhone}.`,
      `Mujhe afsos hai ke aap aisa mehsoos kar rahe hain, aur aap bohat ahem hain. Barah-e-meherbani abhi ${emergencyNumbers} par call karein, ya qareebi emergency jayein, ya kisi bharosemand shakhs ko apne paas bula lein. Clinic ki emergency line ${emergencyPhone} hai.`,
    ),
    links: [{ label: `Call ${emergencyPhone}`, href: `tel:${emergencyPhone.replace(/[^\d+]/g, "")}` }],
  };
}

/**
 * The guard for one turn. `text` is the caller's words after Urdu script has been mapped to Latin. Returns
 * null when nothing is wrong and the turn may go on to a dialog or the answer engine.
 */
export function guardTurn(text: string, pack: KnowledgePack, lang: VoiceLang): Guarded | null {
  const clean = cleanText(text);
  if (!clean) return null;
  if (CRISIS.test(clean)) return { kind: "crisis", reply: crisis(pack, lang), pausesBooking: true };
  if (isEmergencyText(text) || EMERGENCY_EXTRA.test(clean)) return { kind: "emergency", reply: emergency(pack, lang), pausesBooking: true };
  for (const [kind, pattern] of ORDER) {
    if (pattern.test(clean)) return { kind, reply: { intent: `guard_${kind}`, text: REPLIES[kind](pack, lang) }, pausesBooking: false };
  }
  return null;
}
