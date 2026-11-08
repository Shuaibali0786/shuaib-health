// Which language a spoken turn is in, and a small Urdu-script word list (Feature 013, Phase 1).
//
// Browsers listening for Urdu return Urdu script, but the free answer engine matches Latin words. So Urdu
// script is mapped, word by word, to the Roman Urdu / English words the engine already knows. Names and
// rare words stay as they are (the engine ignores them). Replies are English or Roman Urdu in Phase 1.

import { cleanText, detectLang } from "@/agent/normalize";

import type { VoiceLang } from "./types";

export const hasUrduScript = (text: string): boolean => /[؀-ۿ]/.test(text);

// Everyday English function words. A turn is "clearly English" only when it has a few of them, so a name, a
// phone number or a time ("sifar teen sifar sifar...", "Ali Raza") keeps the style of the conversation.
const ENGLISH_MARKERS = new Set(
  "the is are was you your what how when where which who why can could would should do does please want need like with for from about this that have has any some tell show give my me our we it its and or but of to in on at book appointment doctor doctors fee fees hours open timings".split(" "),
);

/**
 * The style to reply in. Roman Urdu words or Urdu letters give Roman Urdu; a turn with several English
 * function words gives English; anything else (a name, digits, "yes") keeps the previous style.
 */
export function replyLanguage(text: string, previous: VoiceLang): VoiceLang {
  if (hasUrduScript(text)) return "roman";
  if (detectLang(text) === "roman") return "roman";
  const words = cleanText(text).split(" ").filter(Boolean);
  return words.filter((w) => ENGLISH_MARKERS.has(w)).length >= 2 ? "en" : previous;
}

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const WORDS: Record<string, string> = {
  ڈاکٹر: "doctor",
  علاج: "ilaaj",
  کروانا: "karwana",
  کروانی: "karwani",
  کرانا: "karwana",
  کروانے: "karwana",
  بلڈ: "blood",
  خونی: "khooni",
  کرو: "karo",
  کر: "kar",
  سکتی: "sakti",
  سکتے: "sakte",
  ہو: "ho",
  کلینک: "clinic",
  چھٹی: "chutti",
  کھلی: "khuli",
  تکلیف: "takleef",
  الرجی: "allergy",
  شوگر: "sugar",
  ڈاٹ: "dot",
  ایٹ: "at",
  ریٹ: "rate",
  دی: "the",
  جیمیل: "gmail",
  کام: "com",
  بک: "book",
  کروں: "karoon",
  چاہتا: "chahta",
  چاہتی: "chahti",
  ٹیسٹنگ: "testing",
  مسئلہ: "masla",
  دانتوں: "daant",
  ڈاکٹرز: "doctors",
  وقت: "waqt",
  ٹائمنگ: "timing",
  ٹائم: "time",
  فیس: "fee",
  قیمت: "qeemat",
  ٹیسٹ: "test",
  ٹیسٹس: "tests",
  لیب: "lab",
  رپورٹ: "report",
  بکنگ: "booking",
  اپائنٹمنٹ: "appointment",
  اپوائنٹمنٹ: "appointment",
  پیکج: "package",
  پیکجز: "packages",
  ڈیپارٹمنٹ: "department",
  کھلا: "khulta",
  کھلتا: "khulta",
  کھلتی: "khulti",
  بند: "band",
  کب: "kab",
  کہاں: "kahan",
  کتنی: "kitni",
  کتنا: "kitna",
  کیا: "kya",
  ہے: "hai",
  ہیں: "hain",
  پتہ: "address",
  پتا: "address",
  لوکیشن: "location",
  فون: "phone",
  نمبر: "number",
  رابطہ: "contact",
  گھر: "ghar",
  سیمپل: "sample",
  نمونہ: "sample",
  دانت: "daant",
  ڈینٹل: "dental",
  جلد: "skin",
  بچہ: "bacha",
  بچے: "bachay",
  بخار: "bukhar",
  درد: "dard",
  کھانسی: "khansi",
  زکام: "zukam",
  سر: "sar",
  پیٹ: "pet",
  دل: "dil",
  سینے: "seena",
  سانس: "saans",
  بے: "be",
  ہوش: "hosh",
  بیہوش: "behosh",
  خون: "khoon",
  دورہ: "daura",
  ایمرجنسی: "emergency",
  آج: "aaj",
  کل: "kal",
  پرسوں: "parson",
  صبح: "subah",
  شام: "sham",
  رات: "raat",
  بجے: "baje",
  میرا: "mera",
  میری: "meri",
  نام: "naam",
  مجھے: "mujhe",
  چاہیے: "chahiye",
  چاہئے: "chahiye",
  کرنا: "karna",
  کرنی: "karni",
  کریں: "karein",
  کرنے: "karne",
  بتائیں: "bataiye",
  بتائیے: "bataiye",
  بتاو: "batao",
  ہاں: "haan",
  جی: "ji",
  نہیں: "nahi",
  نہی: "nahi",
  ٹھیک: "theek",
  شکریہ: "shukriya",
  مہربانی: "meherbani",
  اور: "aur",
  میں: "mein",
  کا: "ka",
  کی: "ki",
  کے: "ke",
  ہوں: "hoon",
  آپ: "aap",
  ہم: "hum",
  سے: "se",
  کو: "ko",
  یہ: "yeh",
  وہ: "woh",
  مہینہ: "month",
  ہفتہ: "week",
  پیر: "monday",
  منگل: "tuesday",
  بدھ: "wednesday",
  جمعرات: "thursday",
  جمعہ: "friday",
  ہفتے: "saturday",
  اتوار: "sunday",
  ایک: "1",
  دو: "2",
  تین: "3",
  چار: "4",
  پانچ: "5",
  چھ: "6",
  سات: "7",
  آٹھ: "8",
  نو: "9",
  دس: "10",
  گیارہ: "11",
  بارہ: "12",
  تیرہ: "13",
  چودہ: "14",
  پندرہ: "15",
};

/** Urdu script to the Latin words the engine knows. Latin text and punctuation pass through unchanged. */
export function urduToLatin(text: string): string {
  if (!hasUrduScript(text) && !/[۰-۹٠-٩]/.test(text)) return text;
  const digits = [...text].map((ch) => {
    const u = URDU_DIGITS.indexOf(ch);
    if (u >= 0) return String(u);
    const a = ARABIC_DIGITS.indexOf(ch);
    return a >= 0 ? String(a) : ch;
  });
  return digits
    .join("")
    .replace(/سی\s*بی\s*سی/g, "cbc")
    .replace(/ای\s*میل/g, "email")
    .replace(/جی\s*میل/g, "gmail")
    .replace(/[؟۔،]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => WORDS[word] ?? word)
    .join(" ");
}
