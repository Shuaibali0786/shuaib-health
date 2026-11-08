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
  const words = [...new Set(cleanText(text).split(" ").filter(Boolean))];
  // Roman Urdu that the shared detector does not list ("rehne do", "chhor do", "galat hai").
  if (words.some((w) => ROMAN_EXTRA.has(w))) return "roman";
  return words.filter((w) => ENGLISH_MARKERS.has(w)).length >= 2 ? "en" : previous;
}

const ROMAN_EXTRA = new Set("rehne rehnay chhor chor chhoro mat galat ghalat sahi theek thik haan han ji jee nahin acha achha accha chalo zaroor bilkul shukriya bhai behen beta abbu ammi bacha bache bachay daane dane jild khansi zukam bukhar sar safai daant".split(" "));

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
  ہفتہ: "saturday",
  پیر: "monday",
  منگل: "tuesday",
  بدھ: "wednesday",
  جمعرات: "thursday",
  جمعہ: "friday",
  ہفتے: "saturday",
  اتوار: "sunday",
  // English words that Urdu listening writes in Urdu letters (owner test 2026-11-08: "سیٹرڈے", "زیرو ٹو تھری").
  سنڈے: "sunday",
  منڈے: "monday",
  ٹیوزڈے: "tuesday",
  ٹیوسڈے: "tuesday",
  وینزڈے: "wednesday",
  ویڈنزڈے: "wednesday",
  وینسڈے: "wednesday",
  تھرزڈے: "thursday",
  تھرسڈے: "thursday",
  فرائیڈے: "friday",
  فرائڈے: "friday",
  سیٹرڈے: "saturday",
  سٹرڈے: "saturday",
  سیچرڈے: "saturday",
  ٹومارو: "tomorrow",
  ٹوڈے: "today",
  نیکسٹ: "next",
  مارننگ: "morning",
  ایوننگ: "evening",
  آفٹرنون: "afternoon",
  ڈیٹ: "date",
  زیرو: "zero",
  ون: "one",
  ٹو: "two",
  تھری: "three",
  فور: "four",
  فائیو: "five",
  فائو: "five",
  سکس: "six",
  سیون: "seven",
  ایٹ: "eight",
  نائن: "nine",
  ٹین: "ten",
  الیون: "eleven",
  ٹویلو: "twelve",
  ٹوئیلو: "twelve",
  تھرٹین: "13",
  فورٹین: "14",
  ففٹین: "15",
  سکسٹین: "16",
  سیونٹین: "17",
  ایٹین: "18",
  نائنٹین: "19",
  ٹوئنٹی: "20",
  تھرٹی: "30",
  ڈبل: "double",
  ٹرپل: "triple",
  جنوری: "january",
  فروری: "february",
  مارچ: "march",
  اپریل: "april",
  مئی: "may",
  جون: "june",
  جولائی: "july",
  اگست: "august",
  ستمبر: "september",
  اکتوبر: "october",
  نومبر: "november",
  نوومبر: "november",
  نوامبر: "november",
  دسمبر: "december",
  ساڑھے: "saade",
  سوا: "sawa",
  پونے: "paune",
  دوپہر: "dopahar",
  یس: "yes",
  اوکے: "ok",
  سکپ: "skip",
  کنفرم: "confirm",
  کینسل: "cancel",
  غلط: "galat",
  صحیح: "sahi",
  ہیلو: "hello",
  السلام: "assalam",
  علیکم: "alaikum",
  وعلیکم: "walaikum",
  // Problems and departments, in Urdu and in English words written in Urdu letters.
  فیور: "fever",
  کف: "cough",
  ہیڈیک: "headache",
  سکن: "skin",
  الرجک: "allergy",
  خارش: "kharish",
  دانے: "daane",
  کیل: "daane",
  مہاسے: "daane",
  صفائی: "safai",
  سفائی: "safai",
  ڈینٹسٹ: "dentist",
  ہارٹ: "heart",
  دھڑکن: "dhadkan",
  پریشر: "pressure",
  ذیابیطس: "diabetes",
  ڈائبیٹیز: "diabetes",
  حمل: "pregnancy",
  حاملہ: "pregnant",
  پریگنینسی: "pregnancy",
  پریگننسی: "pregnancy",
  بچوں: "bachon",
  بچی: "bachi",
  بیٹا: "beta",
  بیٹی: "beti",
  آنکھ: "aankh",
  آنکھوں: "aankh",
  کان: "kaan",
  ناک: "naak",
  گلا: "gala",
  گلے: "gala",
  ہڈی: "haddi",
  ہڈیوں: "haddi",
  جوڑوں: "joron",
  گھٹنے: "ghutne",
  کمر: "kamar",
  دست: "dast",
  الٹی: "ulti",
  الٹیاں: "ulti",
  چکر: "chakkar",
  کمزوری: "kamzori",
  ایکسرے: "xray",
  الٹراساؤنڈ: "ultrasound",
  چیک: "check",
  اپ: "up",
  تھائیرائیڈ: "thyroid",
  کولیسٹرول: "cholesterol",
  ویکسین: "vaccine",
  ٹیکہ: "vaccine",
  ٹیکے: "vaccine",
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
  سولہ: "16",
  سترہ: "17",
  اٹھارہ: "18",
  انیس: "19",
  بیس: "20",
  اکیس: "21",
  بائیس: "22",
  تئیس: "23",
  چوبیس: "24",
  پچیس: "25",
  چھبیس: "26",
  ستائیس: "27",
  اٹھائیس: "28",
  انتیس: "29",
  تیس: "30",
  اکتیس: "31",
};

// Common Pakistani names in Urdu letters, so a name heard by Urdu listening is written in English letters on the
// screen and the slip (owner test: "شعیب علی" must become "Shuaib Ali"). Anything not listed is transliterated.
const NAMES: Record<string, string> = {
  شعیب: "Shuaib", علی: "Ali", محمد: "Muhammad", احمد: "Ahmed", حسن: "Hassan", حسین: "Hussain", فاطمہ: "Fatima", عائشہ: "Ayesha",
  زینب: "Zainab", مریم: "Maryam", سارہ: "Sara", ثنا: "Sana", ثناء: "Sana", نور: "Noor", خان: "Khan", رضا: "Raza", بلال: "Bilal",
  عمر: "Omar", عثمان: "Usman", عمران: "Imran", کامران: "Kamran", آصف: "Asif", طارق: "Tariq", ندیم: "Nadeem", نادیہ: "Nadia",
  صائمہ: "Saima", حنا: "Hina", اسماء: "Asma", عمیر: "Umair", حمزہ: "Hamza", زید: "Zaid", یوسف: "Yousuf", ابراہیم: "Ibrahim",
  عبداللہ: "Abdullah", عبد: "Abdul", رحمان: "Rehman", رحمن: "Rehman", شیخ: "Sheikh", ملک: "Malik", چوہدری: "Chaudhry", بٹ: "Butt",
  قریشی: "Qureshi", صدیقی: "Siddiqui", انصاری: "Ansari", مرزا: "Mirza", شاہ: "Shah", سید: "Syed", اقبال: "Iqbal", جاوید: "Javed",
  اکرم: "Akram", اسلم: "Aslam", ارشد: "Arshad", شاہد: "Shahid", خالد: "Khalid", ریحان: "Rehan", فیصل: "Faisal", سلمان: "Salman",
  زاہد: "Zahid", ثاقب: "Saqib", وقاص: "Waqas", دانش: "Danish", ہارون: "Haroon", اسد: "Asad", سعد: "Saad", عرفان: "Irfan",
  رابعہ: "Rabia", سمیرا: "Sumaira", کرن: "Kiran", مہوش: "Mehwish", انعم: "Anum", ماہم: "Maham", ایمن: "Aiman", علینہ: "Alina",
  ارم: "Iram", عظمیٰ: "Uzma", عظمی: "Uzma", بشریٰ: "Bushra", شازیہ: "Shazia", ناصر: "Nasir", منیر: "Munir", ظفر: "Zafar", عامر: "Aamir",
  کاشف: "Kashif", ثمینہ: "Samina", پروین: "Parveen", نسرین: "Nasreen", شبانہ: "Shabana", عائشا: "Ayesha", فرحان: "Farhan",
  نعمان: "Noman", ذیشان: "Zeeshan", شہزاد: "Shahzad", نوید: "Naveed", وسیم: "Waseem", رضوان: "Rizwan", سہیل: "Sohail", عادل: "Adil",
  طاہر: "Tahir", جمیل: "Jamil", نبیل: "Nabeel", انیلا: "Anila", صبا: "Saba", ہما: "Huma", لائبہ: "Laiba", مصطفیٰ: "Mustafa",
  بیگم: "Begum",راجہ: "Raja", ممتاز: "Mumtaz", زبیر: "Zubair", اویس: "Awais", حماد: "Hammad", طلحہ: "Talha",
};

// Letter by letter, for a word no list knows (most often a name). Rough but always in English letters.
const LETTERS: Record<string, string> = {
  ا: "a", آ: "aa", أ: "a", إ: "i", ب: "b", پ: "p", ت: "t", ٹ: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ڈ: "d", ذ: "z",
  ر: "r", ڑ: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ک: "k", ك: "k",
  گ: "g", ل: "l", م: "m", ن: "n", ں: "n", و: "o", ہ: "h", ه: "h", ھ: "h", ء: "", ی: "i", ي: "i", ے: "e", ئ: "i", ۃ: "a", ة: "a", ى: "a",
};

/** One word in Urdu letters written in English letters ("شعیب" -> "Shuaib" from the list, else letter by letter). */
export function transliterateWord(word: string): string {
  const known = NAMES[word];
  if (known) return known;
  let out = "";
  const chars = [...word];
  chars.forEach((ch, i) => {
    if (ch === "و" && i === 0) out += "w";
    else if (ch === "ی" && i === 0) out += "y";
    else if (ch === "ہ" && i === chars.length - 1 && i > 0) out += "a";
    else if (/[ً-ٰٟ]/.test(ch)) out += "";
    else out += LETTERS[ch] ?? (/[؀-ۿ]/.test(ch) ? "" : ch);
  });
  out = out.replace(/(.)\1{2,}/g, "$1$1");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

// Two-word forms, matched before the word list (spaces vary in what listening returns).
const SCRIPT_PHRASES: Array<[RegExp, string]> = [
  [/ایٹ\s*دی\s*ریٹ/g, " at the rate "],
  [/ایٹ\s+(?=جی\s*میل|ہاٹ\s*میل|یاہو)/g, " at "],
  [/سی\s*بی\s*سی/g, " cbc "],
  [/ای\s*میل/g, " email "],
  [/جی\s*میل/g, " gmail "],
  [/ہاٹ\s*میل/g, " hotmail "],
  [/ڈاٹ\s*کام/g, " dot com "],
  [/پی\s*ایم/g, " pm "],
  [/اے\s*ایم/g, " am "],
  [/بی\s*پی/g, " bp "],
  [/ایکس\s*رے/g, " xray "],
  [/بلڈ\s*پریشر/g, " blood pressure "],
  [/(?:سیٹر|سٹر|سیچر)\s+ڈے/g, " saturday "],
  [/فرائی\s+ڈے/g, " friday "],
  [/من\s+ڈے/g, " monday "],
  [/ٹیوز\s+ڈے/g, " tuesday "],
  [/وینز\s+ڈے/g, " wednesday "],
  [/تھر[سز]\s+ڈے/g, " thursday "],
  [/سن\s+ڈے/g, " sunday "],
  [/رہنے\s+(?:دو|دیں|دیجیے)/g, " rehne do "],
  [/چھوڑ\s+(?:دو|دیں)/g, " chhor do "],
  [/السلام\s*(?:و\s*)?علیکم/g, " assalam o alaikum "],
];

const DIGIT_WORD_SET = new Set(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]);
/** Words after which Urdu "دو" means "do" (give / do it), not the number two. */
const DO_VERBS = new Set(["kar", "karo", "de", "bata", "le", "karwa", "kara", "rehne", "chhor", "ho", "dikha", "bhej"]);

/**
 * Urdu script to Latin: the words the engine knows, English words written in Urdu letters ("سیٹرڈے" -> "saturday",
 * "زیرو ٹو" -> "zero two"), and everything else (names) letter by letter, so the result never has Urdu letters.
 * "نمبر" right after a day of the month is November ("13 نمبر"), as listening often writes it. Latin text and
 * punctuation pass through unchanged.
 */
export function urduToLatin(text: string): string {
  if (!hasUrduScript(text) && !/[۰-۹٠-٩]/.test(text)) return text;
  let s = [...text]
    .map((ch) => {
      const u = URDU_DIGITS.indexOf(ch);
      if (u >= 0) return String(u);
      const a = ARABIC_DIGITS.indexOf(ch);
      return a >= 0 ? String(a) : ch;
    })
    .join("");
  for (const [pattern, to] of SCRIPT_PHRASES) s = s.replace(pattern, to);
  // Keep Latin punctuation attached to words apart from the Urdu letters ("بخار،" -> "bukhar ,").
  s = s.replace(/[؟]/g, " ? ").replace(/[۔،]/g, " ");
  const out: string[] = [];
  for (const word of s.split(/\s+/).filter(Boolean)) {
    if (!hasUrduScript(word)) {
      out.push(word);
      continue;
    }
    const prev = (out.at(-1) ?? "").toLowerCase();
    if (word === "دو" && DO_VERBS.has(prev)) {
      out.push("do");
      continue;
    }
    if (word === "نمبر" && (/^\d{1,2}$/.test(prev) || DIGIT_WORD_SET.has(prev))) {
      out.push("november");
      continue;
    }
    const mapped = WORDS[word];
    if (mapped) {
      out.push(mapped);
      continue;
    }
    // Words joined to "ko", "ka", "ki" etc. by listening ("ہفتےکو") are rare; anything unknown is a name or a rare word.
    const latin = transliterateWord(word);
    if (latin) out.push(latin);
  }
  return out.join(" ").replace(/\s+\?/g, "?");
}

/** True when text came (at least partly) in Urdu letters: names from it need a spelling check. */
export const cameInUrduScript = hasUrduScript;
