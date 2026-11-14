// For the Urdu voice only (Feature 013): a Roman Urdu sentence is rewritten, word by word, into Urdu script wherever
// the word is known, because an Urdu voice reads Urdu script perfectly but spells Latin letters out. Names, English
// loan words (doctor, booking, phone, CBC) and anything unknown stay as they are. Captions never change.

const PHRASES: Array<[RegExp, string]> = [
  [/\bassalam[\s-]*o[\s-]*alaikum\b/gi, "السلام علیکم"],
  [/\bwa[\s-]*alaikum[\s-]*(?:us|as)?[\s-]*salam\b/gi, "وعلیکم السلام"],
  [/\bkhuda hafiz\b|\ballah hafiz\b/gi, "اللہ حافظ"],
  [/\bji zaroor\b/gi, "جی ضرور"],
  [/\bkoi baat nahi\b/gi, "کوئی بات نہیں"],
  [/\bmaaf kijiye\b/gi, "معاف کیجیے"],
  [/\bbarah-e-meherbani\b/gi, "براہِ مہربانی"],
  [/\btheek hai\b/gi, "ٹھیک ہے"],
  [/\bji haan\b/gi, "جی ہاں"],
];

const WORDS: Record<string, string> = {
  aap: "آپ", ap: "آپ", ka: "کا", ki: "کی", ke: "کے", ko: "کو", se: "سے", mein: "میں", par: "پر", hai: "ہے", hain: "ہیں", hoon: "ہوں", hun: "ہوں",
  tha: "تھا", thi: "تھی", kya: "کیا", kab: "کب", kahan: "کہاں", kitni: "کتنی", kitna: "کتنا", kitne: "کتنے", kaun: "کون", kaise: "کیسے", kyun: "کیوں",
  aur: "اور", ya: "یا", nahi: "نہیں", nahin: "نہیں", haan: "ہاں", ji: "جی", zaroor: "ضرور", bataiye: "بتائیے", bata: "بتا", dein: "دیں", den: "دیں", diya: "دیا",
  kar: "کر", karein: "کریں", karna: "کرنا", karne: "کرنے", karni: "کرنی", karungi: "کروں گی", karti: "کرتی", sakti: "سکتی", sakta: "سکتا", sakte: "سکتے",
  main: "میں", mujhe: "مجھے", mera: "میرا", meri: "میری", mere: "میرے", hamara: "ہمارا", hamare: "ہمارے", hamari: "ہماری", ab: "اب", abhi: "ابھی", bhi: "بھی",
  sirf: "صرف", sab: "سب", sabhi: "سبھی", kuch: "کچھ", koi: "کوئی", is: "اس", us: "اس", yeh: "یہ", woh: "وہ", liye: "لیے", saath: "ساتھ", baad: "بعد",
  pehle: "پہلے", naam: "نام", poora: "پورا", waqt: "وقت", din: "دن", kal: "کل", aaj: "آج", subah: "صبح", shaam: "شام", raat: "رات", baje: "بجے",
  shukriya: "شکریہ", maaf: "معاف", theek: "ٹھیک", intezaar: "انتظار", madad: "مدد", chahiye: "چاہیے", chahte: "چاہتے", chahta: "چاہتا", chahti: "چاہتی",
  milna: "ملنا", mil: "مل", khushi: "خوشی", hui: "ہوئی", ho: "ہو", gayi: "گئی", gaya: "گیا", raha: "رہا", rahi: "رہی", rahe: "رہے", wajah: "وجہ",
  chand: "چند", alfaaz: "الفاظ", kaafi: "کافی", aahista: "آہستہ", bolein: "بولیں", batayen: "بتائیں", dobara: "دوبارہ", koshish: "کوشش",
  mehfooz: "محفوظ", record: "ریکارڈ", save: "سیو", awaaz: "آواز", demo: "ڈیمو", clinic: "کلینک", assistant: "اسسٹنٹ", booking: "بکنگ", appointment: "اپائنٹمنٹ",
  ghalat: "غلط", pata: "پتا", rabta: "رابطہ", call: "کال", kuchh: "کچھ", dekh: "دیکھ", wali: "والی", wala: "والا",
  agle: "اگلے", pichle: "پچھلے", mukammal: "مکمل", hasil: "حاصل", ghar: "گھر", sample: "سیمپل", qeemat: "قیمت", fee: "فیس", report: "رپورٹ",
};

/** The sentence with every known Roman Urdu phrase and word in Urdu script. Unknown words are left alone. */
export function urduSpeech(sentence: string): string {
  let text = sentence;
  for (const [pattern, urdu] of PHRASES) text = text.replace(pattern, urdu);
  return text.replace(/[A-Za-z][A-Za-z-]*/g, (word) => WORDS[word.toLowerCase()] ?? word);
}
