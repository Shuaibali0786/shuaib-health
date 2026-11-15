// Which speech provider a voice conversation uses (Feature 013). "browser" is the free default. "azure" is the premium
// neural voice and listening, switched on by configuration only (VOICE_PROVIDER=azure); it falls back to the browser
// silently whenever it is not available. The conversation code is the same for both.

import { createAzureSpeech } from "./azureSpeech";
import { createBrowserSpeech } from "./browserSpeech";
import type { SpeechPort } from "./types";

export type SpeechProviderId = "browser" | "azure";

export function createSpeechPort(provider: SpeechProviderId): SpeechPort {
  const browser = createBrowserSpeech();
  return provider === "azure" ? createAzureSpeech({ fallback: browser }) : browser;
}
