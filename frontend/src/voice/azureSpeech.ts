// The premium voice provider (Feature 013): Azure neural text-to-speech (Jenny for English, Uzma for Urdu) and Azure
// speech-to-text (English and Urdu, detected automatically), so listening also works in Edge and on phones.
//
// OFF unless VOICE_PROVIDER=azure. The key never reaches the browser: our own server hands out a short-lived token
// (rate-limited). The SDK is loaded only when voice mode opens. If anything fails (no token, the free tier's single
// listening slot is busy, a network error), this falls back to the free browser voice silently, for the rest of the visit.

import { fetchSpeechToken, type SpeechToken } from "@/lib/booking/client";

import type { ListenHandlers, SpeakHandlers, SpeakOptions, SpeechPort, VoiceInfo } from "./types";
import { pickVoiceSet } from "./voicePicker";

// The parts of the Speech SDK this file uses, so tests can hand in a small fake.
type SdkConfig = { speechRecognitionLanguage?: string };
type SdkRecognizer = {
  recognizing: (sender: unknown, event: { result: { text: string } }) => void;
  recognized: (sender: unknown, event: { result: { text: string; reason: number } }) => void;
  canceled: (sender: unknown, event: { errorDetails?: string }) => void;
  startContinuousRecognitionAsync(done?: () => void, fail?: (error: string) => void): void;
  stopContinuousRecognitionAsync(done?: () => void, fail?: (error: string) => void): void;
  close(): void;
};
type SdkSynthesizer = {
  wordBoundary: (sender: unknown, event: unknown) => void;
  speakSsmlAsync(ssml: string, done?: (result: { errorDetails?: string }) => void, fail?: (error: string) => void): void;
  close(): void;
};
type SdkPlayer = { onAudioStart: (sender: unknown) => void; onAudioEnd: (sender: unknown) => void; pause(): void; close(): void };
export type SpeechSdk = {
  SpeechConfig: { fromAuthorizationToken(token: string, region: string): SdkConfig };
  AudioConfig: { fromDefaultMicrophoneInput(): unknown; fromSpeakerOutput(player?: unknown): unknown };
  AutoDetectSourceLanguageConfig: { fromLanguages(languages: string[]): unknown };
  SpeechRecognizer: { FromConfig(config: SdkConfig, languages: unknown, audio: unknown): SdkRecognizer };
  SpeechSynthesizer: new (config: SdkConfig, audio: unknown) => SdkSynthesizer;
  SpeakerAudioDestination: new () => SdkPlayer;
  ResultReason: { RecognizedSpeech: number };
};

/** The two neural voices, offered to the voice picker like device voices (one is locked per conversation). */
export const AZURE_VOICES: ReadonlyArray<VoiceInfo & { azure: string }> = [
  { name: "Azure Jenny Online (Natural) - English (United States)", lang: "en-US", local: false, azure: "en-US-JennyNeural" },
  { name: "Azure Uzma Online (Natural) - Urdu (Pakistan)", lang: "ur-PK", local: false, azure: "ur-PK-UzmaNeural" },
];
const LISTEN_LANGUAGES = ["en-US", "ur-PK"];

const azureVoiceOf = (voice: VoiceInfo | null) => AZURE_VOICES.find((v) => v.name === voice?.name)?.azure ?? null;
const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function ssmlFor(text: string, voice: string, rate = 1): string {
  const lang = voice.slice(0, 5);
  const percent = Math.round((rate - 1) * 100);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}"><prosody rate="${percent}%">${escapeXml(text)}</prosody></voice></speak>`;
}

export function createAzureSpeech(options: {
  fallback: SpeechPort;
  getToken?: () => Promise<SpeechToken>;
  loadSdk?: () => Promise<SpeechSdk>;
  now?: () => number;
  hasMicrophone?: boolean;
}): SpeechPort {
  const fallback = options.fallback;
  const getToken = options.getToken ?? fetchSpeechToken;
  const loadSdk = options.loadSdk ?? (async () => (await import("microsoft-cognitiveservices-speech-sdk")) as unknown as SpeechSdk);
  const now = options.now ?? Date.now;
  const hasMicrophone = options.hasMicrophone ?? (typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));

  let failed = false;
  let sdk: SpeechSdk | null = null;
  let token: { value: string; region: string; until: number } | null = null;
  let recognizer: SdkRecognizer | null = null;
  let wantListen = false;
  let synth: SdkSynthesizer | null = null;
  let player: SdkPlayer | null = null;
  let finishSpeech: ((cancelled: boolean) => void) | null = null;
  let browserVoices: VoiceInfo[] | null = null;

  async function ready(): Promise<{ sdk: SpeechSdk; config: SdkConfig } | null> {
    if (failed) return null;
    try {
      sdk ??= await loadSdk();
      if (!token || now() >= token.until) {
        const t = await getToken();
        token = { value: t.token, region: t.region, until: now() + Math.max(30, t.expiresInSeconds - 60) * 1000 };
      }
      return { sdk, config: sdk.SpeechConfig.fromAuthorizationToken(token.value, token.region) };
    } catch {
      failed = true;
      return null;
    }
  }

  /** The browser voice that stands in for a neural voice, in the same language, when the browser takes over. */
  async function standIn(options_: SpeakOptions): Promise<SpeakOptions> {
    if (!azureVoiceOf(options_.voice)) return options_;
    browserVoices ??= await fallback.voices().catch(() => []);
    const set = pickVoiceSet(browserVoices, "female");
    const voice = options_.lang.toLowerCase().startsWith("ur") ? (set.urdu ?? set.romanFallback) : (set.english ?? set.romanFallback);
    return { ...options_, voice, lang: voice?.lang ?? options_.lang };
  }

  function closeRecognizer() {
    const r = recognizer;
    recognizer = null;
    if (!r) return;
    try {
      r.stopContinuousRecognitionAsync(
        () => r.close(),
        () => r.close(),
      );
    } catch {
      // already closed
    }
  }

  function listenWithBrowser(lang: string, handlers: ListenHandlers) {
    if (wantListen) fallback.listen(lang, handlers);
  }

  return {
    canListen: hasMicrophone || fallback.canListen,
    canSpeak: true,

    listen(lang: string, handlers: ListenHandlers) {
      wantListen = true;
      void (async () => {
        const r = await ready();
        if (!wantListen) return;
        if (!r || !hasMicrophone) return listenWithBrowser(lang, handlers);
        try {
          const languages = r.sdk.AutoDetectSourceLanguageConfig.fromLanguages(LISTEN_LANGUAGES);
          const rec = r.sdk.SpeechRecognizer.FromConfig(r.config, languages, r.sdk.AudioConfig.fromDefaultMicrophoneInput());
          rec.recognizing = (_sender, event) => {
            if (event.result.text) handlers.onInterim(event.result.text);
          };
          rec.recognized = (_sender, event) => {
            if (event.result.reason === r.sdk.ResultReason.RecognizedSpeech && event.result.text.trim()) handlers.onFinal(event.result.text.trim());
          };
          // Busy (the free tier allows one listener at a time), a lost connection, an expired token: hand over quietly.
          rec.canceled = (_sender, event) => {
            if (!event.errorDetails) return;
            closeRecognizer();
            failed = true;
            listenWithBrowser(lang, handlers);
          };
          recognizer = rec;
          rec.startContinuousRecognitionAsync(undefined, () => {
            closeRecognizer();
            failed = true;
            listenWithBrowser(lang, handlers);
          });
        } catch {
          failed = true;
          listenWithBrowser(lang, handlers);
        }
      })();
    },

    stopListening() {
      wantListen = false;
      closeRecognizer();
      fallback.stopListening();
    },

    speak(chunks: string[], speakOptions: SpeakOptions, handlers: SpeakHandlers) {
      void (async () => {
        const r = await ready();
        const voice = azureVoiceOf(speakOptions.voice);
        if (!r || !voice) {
          fallback.speak(chunks, await standIn(speakOptions), handlers);
          return;
        }
        let done = false;
        let started = false;
        const finish = (cancelled: boolean) => {
          if (done) return;
          done = true;
          finishSpeech = null;
          handlers.onEnd(cancelled);
        };
        const handOver = async () => {
          failed = true;
          if (started) return finish(false);
          done = true;
          finishSpeech = null;
          fallback.speak(chunks, await standIn(speakOptions), handlers);
        };
        try {
          const p = new r.sdk.SpeakerAudioDestination();
          player = p;
          p.onAudioStart = () => {
            started = true;
            handlers.onStart?.();
          };
          p.onAudioEnd = () => finish(false);
          const s = new r.sdk.SpeechSynthesizer(r.config, r.sdk.AudioConfig.fromSpeakerOutput(p));
          synth = s;
          s.wordBoundary = () => handlers.onBoundary?.();
          finishSpeech = finish;
          s.speakSsmlAsync(
            ssmlFor(chunks.join(" "), voice, speakOptions.rate ?? 1),
            (result) => {
              s.close();
              if (result.errorDetails) void handOver();
            },
            () => {
              s.close();
              void handOver();
            },
          );
        } catch {
          void handOver();
        }
      })();
    },

    cancelSpeech() {
      try {
        player?.pause();
        player?.close();
        synth?.close();
      } catch {
        // already closed
      }
      player = null;
      synth = null;
      finishSpeech?.(true);
      fallback.cancelSpeech();
    },

    voices: () => Promise.resolve(failed ? fallback.voices() : [...AZURE_VOICES]),
  };
}
