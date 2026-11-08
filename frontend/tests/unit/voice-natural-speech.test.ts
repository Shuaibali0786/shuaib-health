// Feature 013: the voice sounds warm, not robotic: natural voices first, the right voice for each sentence, and
// text rewritten the way a receptionist would say it.
import { describe, expect, it } from "vitest";

import { forSpeech } from "@/voice/speechText";
import { urduSpeech } from "@/voice/urduSpeech";
import type { VoiceInfo } from "@/voice/types";
import { chooseVoice, menuVoices, pickVoiceSet, voiceLabel } from "@/voice/voicePicker";

const v = (name: string, lang: string, local = false): VoiceInfo => ({ name, lang, local });

const EDGE: VoiceInfo[] = [
  v("Microsoft David - English (United States)", "en-US", true),
  v("Microsoft Zira - English (United States)", "en-US", true),
  v("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
  v("Microsoft Jenny Online (Natural) - English (United States)", "en-US"),
  v("Microsoft Guy Online (Natural) - English (United States)", "en-US"),
  v("Microsoft Andrew Online (Natural) - English (United States)", "en-US"),
  v("Microsoft Neerja Online (Natural) - English (India)", "en-IN"),
  v("Microsoft Uzma Online (Natural) - Urdu (Pakistan)", "ur-PK"),
  v("Microsoft Asad Online (Natural) - Urdu (Pakistan)", "ur-PK"),
  v("Microsoft Hemant - Hindi (India)", "hi-IN", true),
  v("Microsoft Hortense - French (France)", "fr-FR", true),
];

describe("the voices chosen", () => {
  it("female: Aria for English and Uzma for Urdu", () => {
    const set = pickVoiceSet(EDGE, "female");
    expect(set.english?.name).toContain("Aria");
    expect(set.urdu?.name).toContain("Uzma");
  });
  it("male: Guy for English and Asad for Urdu", () => {
    const set = pickVoiceSet(EDGE, "male");
    expect(set.english?.name).toContain("Guy");
    expect(set.urdu?.name).toContain("Asad");
  });
  it("falls back gracefully: a natural voice over a plain one, a plain one over none, no Urdu voice means Indian English", () => {
    const noUrdu = EDGE.filter((x) => !x.lang.startsWith("ur"));
    const set = pickVoiceSet(noUrdu, "female");
    expect(set.urdu).toBeNull();
    expect(set.romanFallback?.name).toContain("Neerja");
    const plain = pickVoiceSet([v("Microsoft David - English (United States)", "en-US", true), v("Microsoft Zira - English (United States)", "en-US", true)], "female");
    expect(plain.english?.name).toContain("Zira");
    const none = pickVoiceSet([], "female");
    expect(none).toEqual({ english: null, urdu: null, romanFallback: null });
  });
});

describe("the voice for each sentence", () => {
  const set = pickVoiceSet(EDGE, "female");
  it("Roman Urdu and greetings go to the Urdu voice (rewritten in Urdu script); English goes to the English voice", () => {
    const urdu = chooseVoice(set, true, null);
    expect(urdu.voice?.name).toContain("Uzma");
    expect(urdu.urduScript).toBe(true);
    expect(urdu.langTag).toBe("ur-PK");
    const english = chooseVoice(set, false, null);
    expect(english.voice?.name).toContain("Aria");
    expect(english.urduScript).toBe(false);
  });
  it("without an Urdu voice, Roman Urdu is read by the English voice that suits it, with no rewriting", () => {
    const choice = chooseVoice(pickVoiceSet(EDGE.filter((x) => !x.lang.startsWith("ur")), "female"), true, null);
    expect(choice.voice?.name).toContain("Neerja");
    expect(choice.urduScript).toBe(false);
  });
  it("a voice picked in the menu reads everything", () => {
    const jenny = EDGE.find((x) => x.name.includes("Jenny")) as VoiceInfo;
    expect(chooseVoice(set, true, jenny).voice).toBe(jenny);
    expect(chooseVoice(set, false, jenny).voice).toBe(jenny);
  });
  it("with no voices at all it still gives a language so the browser picks something", () => {
    expect(chooseVoice(pickVoiceSet([], "female"), false, null)).toEqual({ voice: null, langTag: "en-GB", urduScript: false });
    expect(chooseVoice(pickVoiceSet([], "female"), true, null).langTag).toBe("en-IN");
  });
});

describe("the Voice menu list", () => {
  it("offers English, Urdu and Hindi voices, natural ones first, with readable labels", () => {
    const list = menuVoices(EDGE);
    expect(list.some((x) => x.lang === "fr-FR")).toBe(false);
    expect(list.slice(0, 7).every((x) => /natural/i.test(x.name))).toBe(true);
    expect(voiceLabel(EDGE[2] as VoiceInfo)).toBe("Aria (Natural), English (United States)");
    expect(voiceLabel(EDGE[0] as VoiceInfo)).toBe("David, English (United States)");
  });
});

describe("text made ready for speech", () => {
  it("says money, times zones, day names and dashes naturally", () => {
    expect(forSpeech("Consultation fee: PKR 3,000 (sample price).")).toBe("Consultation fee: 3,000 rupees (sample price).");
    expect(forSpeech("We are open Mon–Sat, 9 AM – 9 PM PKT.")).toBe("We are open Monday to Saturday, 9 AM to 9 PM Pakistan time.");
  });
  it("reads a phone number digit by digit and drops symbols", () => {
    expect(forSpeech("Phone +92 21 0000 0001.")).toBe("Phone plus nine two, two one, zero zero zero zero, zero zero zero one.");
    expect(forSpeech("Ji, checking… → one moment • please")).toBe("Ji, checking. one moment please");
  });
  it("leaves ordinary sentences alone", () => {
    expect(forSpeech("Which day suits you?")).toBe("Which day suits you?");
  });
});

describe("Roman Urdu for the Urdu voice", () => {
  it("writes greetings and known words in Urdu script and keeps names and English words", () => {
    expect(urduSpeech("Assalam o Alaikum!")).toBe("السلام علیکم!");
    expect(urduSpeech("Ji zaroor, Dr. Ayesha Rahman ke saath.")).toBe("جی ضرور, Dr. Ayesha Rahman کے ساتھ.");
    expect(urduSpeech("Aap ka poora naam kya hai?")).toBe("آپ کا پورا نام کیا ہے؟".replace("؟", "?"));
  });
});
