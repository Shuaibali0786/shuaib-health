// A closed list of spoken yes and no words (Feature 013, FR-045). The booking is submitted ONLY on "yes" from
// here, so the list is strict: a yes mixed with a doubt, a change or a "hmm" is NOT a yes.

import { cleanText } from "@/agent/normalize";

export type YesNo = "yes" | "no" | "unclear";

// At least one of these must be present for a yes.
const YES_CORE = new Set(
  "yes yeah yep yup yess confirm confirmed correct sure absolutely definitely haan han haa bilkul zaroor theek thik dein den kardo kardein karden karo".split(" "),
);
// These may surround a yes but never make one ("ok", "ji" and "please" alone are not a yes).
const FILLER = new Set(
  "ok okay ji jee jiji please plz pls sir madam maam thanks thank you i it is that go ahead proceed hai ho jayega book kar kijiye kijye karein booking appointment this the all and so then just do".split(" "),
);
// Any of these means "not yet / not that / I am unsure".
const NO = new Set("no nope nah nahi nahin na mat cancel stop galat wrong".split(" "));
const DOUBT = new Set("not dont don't wait ruko hold but lekin magar par change badal badlo hmm hm hmmm um uh umm maybe shayad actually except however instead pehle".split(" "));

export function parseYesNo(text: string): YesNo {
  const words = cleanText(text).split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 8) return "unclear";
  if (words.some((w) => NO.has(w))) return words.some((w) => YES_CORE.has(w)) ? "unclear" : "no";
  if (words.some((w) => DOUBT.has(w))) return "unclear";
  if (!words.some((w) => YES_CORE.has(w))) return "unclear";
  return words.every((w) => YES_CORE.has(w) || FILLER.has(w)) ? "yes" : "unclear";
}
