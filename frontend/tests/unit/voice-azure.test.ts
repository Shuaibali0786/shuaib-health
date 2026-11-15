// Feature 013: the premium voice adapter with a fake Speech SDK: one neural voice (Jenny / Uzma), English and Urdu
// listening, a token from our own route, barge-in, and a silent fallback to the browser voice on any failure.
import { describe, expect, it, vi } from "vitest";

import { AZURE_VOICES, createAzureSpeech, ssmlFor, type SpeechSdk } from "@/voice/azureSpeech";
import { createFakeSpeech } from "@/voice/fakeSpeech";
import type { ListenHandlers } from "@/voice/types";

type Listener = { recognizing?: (s: unknown, e: { result: { text: string } }) => void; recognized?: (s: unknown, e: { result: { text: string; reason: number } }) => void; canceled?: (s: unknown, e: { errorDetails?: string }) => void };

function fakeSdk(options: { failStart?: boolean; failSpeak?: boolean } = {}) {
  const spoken: string[] = [];
  const recognizers: Array<Listener & { started: boolean; stopped: boolean }> = [];
  const players: Array<{ onAudioStart: (s: unknown) => void; onAudioEnd: (s: unknown) => void; paused: boolean }> = [];
  const configs: Array<{ token: string; region: string }> = [];
  let languages: string[] = [];
  const sdk: SpeechSdk = {
    SpeechConfig: {
      fromAuthorizationToken: (token, region) => {
        configs.push({ token, region });
        return {};
      },
    },
    AudioConfig: { fromDefaultMicrophoneInput: () => ({}), fromSpeakerOutput: (player) => player },
    AutoDetectSourceLanguageConfig: {
      fromLanguages: (langs) => {
        languages = langs;
        return {};
      },
    },
    SpeechRecognizer: {
      FromConfig: () => {
        const r = {
          started: false,
          stopped: false,
          recognizing: () => undefined,
          recognized: () => undefined,
          canceled: () => undefined,
          startContinuousRecognitionAsync(done?: () => void, fail?: (e: string) => void) {
            if (options.failStart) fail?.("busy");
            else {
              r.started = true;
              done?.();
            }
          },
          stopContinuousRecognitionAsync(done?: () => void) {
            r.stopped = true;
            done?.();
          },
          close() {},
        };
        recognizers.push(r);
        return r;
      },
    },
    SpeechSynthesizer: class {
      wordBoundary: (s: unknown, e: unknown) => void = () => undefined;
      private readonly player: { onAudioStart: (s: unknown) => void; onAudioEnd: (s: unknown) => void };
      constructor(_config: unknown, audio: unknown) {
        this.player = audio as never;
      }
      speakSsmlAsync(ssml: string, done?: (r: { errorDetails?: string }) => void, fail?: (e: string) => void) {
        if (options.failSpeak) return fail?.("network");
        spoken.push(ssml);
        this.player.onAudioStart({});
        this.wordBoundary({}, {});
        done?.({});
      }
      close() {}
    } as never,
    SpeakerAudioDestination: class {
      onAudioStart: (s: unknown) => void = () => undefined;
      onAudioEnd: (s: unknown) => void = () => undefined;
      paused = false;
      constructor() {
        players.push(this);
      }
      pause() {
        this.paused = true;
      }
      close() {}
    } as never,
    ResultReason: { RecognizedSpeech: 3 },
  };
  return { sdk, spoken, recognizers, players, configs, get languages() { return languages; } };
}

const token = vi.fn(async () => ({ token: "eyJ-fake-token-0123456789", region: "southeastasia", expiresInSeconds: 600 }));
const handlers = (): ListenHandlers & { interims: string[]; finals: string[]; errors: string[] } => {
  const h = { interims: [] as string[], finals: [] as string[], errors: [] as string[], onInterim: (t: string) => h.interims.push(t), onFinal: (t: string) => h.finals.push(t), onError: (c: string) => h.errors.push(c) };
  return h as never;
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("premium voice (Azure) adapter", () => {
  it("offers exactly the two neural voices: Jenny for English, Uzma for Urdu", async () => {
    const port = createAzureSpeech({ fallback: createFakeSpeech(), loadSdk: async () => fakeSdk().sdk, getToken: token, hasMicrophone: true });
    const voices = await port.voices();
    expect(voices.map((v) => v.lang)).toEqual(["en-US", "ur-PK"]);
    expect(AZURE_VOICES.map((v) => v.azure)).toEqual(["en-US-JennyNeural", "ur-PK-UzmaNeural"]);
  });

  it("speaks with the chosen neural voice through SSML, a little slower, with word boundaries", async () => {
    const fake = fakeSdk();
    const port = createAzureSpeech({ fallback: createFakeSpeech(), loadSdk: async () => fake.sdk, getToken: token, hasMicrophone: true });
    const onStart = vi.fn();
    const onBoundary = vi.fn();
    const onEnd = vi.fn();
    port.speak(["السلام علیکم!"], { lang: "ur-PK", voice: AZURE_VOICES[1] ?? null, rate: 0.95 }, { onStart, onBoundary, onEnd });
    await flush();
    expect(fake.spoken[0]).toContain('<voice name="ur-PK-UzmaNeural">');
    expect(fake.spoken[0]).toContain('rate="-5%"');
    expect(fake.spoken[0]).toContain("السلام علیکم!");
    expect(onStart).toHaveBeenCalled();
    expect(onBoundary).toHaveBeenCalled();
    fake.players[0]?.onAudioEnd({});
    expect(onEnd).toHaveBeenCalledWith(false);
    expect(fake.configs[0]).toEqual({ token: "eyJ-fake-token-0123456789", region: "southeastasia" });
  });

  it("escapes text in SSML", () => {
    expect(ssmlFor("Fee <PKR> & tax", "en-US-JennyNeural")).toContain("Fee &lt;PKR&gt; &amp; tax");
  });

  it("listens in English and Urdu (detected automatically) and reports interim and final words", async () => {
    const fake = fakeSdk();
    const port = createAzureSpeech({ fallback: createFakeSpeech(), loadSdk: async () => fake.sdk, getToken: token, hasMicrophone: true });
    const h = handlers();
    port.listen("en-IN", h);
    await flush();
    expect(fake.languages).toEqual(["en-US", "ur-PK"]);
    const rec = fake.recognizers[0];
    expect(rec?.started).toBe(true);
    rec?.recognizing?.({}, { result: { text: "mujhe CBC" } });
    rec?.recognized?.({}, { result: { text: "mujhe CBC test karwana hai", reason: 3 } });
    expect(h.interims).toEqual(["mujhe CBC"]);
    expect(h.finals).toEqual(["mujhe CBC test karwana hai"]);
    port.stopListening();
    expect(rec?.stopped).toBe(true);
  });

  it("barge-in: cancelling stops the audio at once and ends the speech as cancelled", async () => {
    const fake = fakeSdk();
    const port = createAzureSpeech({ fallback: createFakeSpeech(), loadSdk: async () => fake.sdk, getToken: token, hasMicrophone: true });
    const onEnd = vi.fn();
    port.speak(["A long answer."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd });
    await flush();
    port.cancelSpeech();
    expect(fake.players[0]?.paused).toBe(true);
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it("no token (flag off on the API, or a rate limit): the browser voice speaks and listens instead, silently", async () => {
    const browser = createFakeSpeech({ voices: [{ name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US", local: false }] });
    const port = createAzureSpeech({ fallback: browser, loadSdk: async () => fakeSdk().sdk, getToken: async () => Promise.reject(new Error("404")), hasMicrophone: true });
    const onEnd = vi.fn();
    port.speak(["Hello."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd });
    await flush();
    await flush();
    expect(browser.spoken[0]?.text).toBe("Hello.");
    expect(browser.spoken[0]?.voice).toContain("Jenny"); // a browser voice stands in, never a neural name
    port.listen("en-IN", handlers());
    await flush();
    expect(browser.listening).toBe(true);
    expect((await port.voices())[0]?.name).toContain("Microsoft");
  });

  it("the free tier's single listener is busy (or the connection drops): listening hands over to the browser", async () => {
    const browser = createFakeSpeech();
    const fake = fakeSdk({ failStart: true });
    const port = createAzureSpeech({ fallback: browser, loadSdk: async () => fake.sdk, getToken: token, hasMicrophone: true });
    port.listen("en-IN", handlers());
    await flush();
    expect(browser.listening).toBe(true);
  });

  it("a speech error before any audio hands the same sentence to the browser voice", async () => {
    const browser = createFakeSpeech();
    const port = createAzureSpeech({ fallback: browser, loadSdk: async () => fakeSdk({ failSpeak: true }).sdk, getToken: token, hasMicrophone: true });
    port.speak(["Hello."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd: vi.fn() });
    await flush();
    await flush();
    expect(browser.spoken.map((s) => s.text)).toEqual(["Hello."]);
  });

  it("asks for a token once and reuses it until it is about to expire", async () => {
    const getToken = vi.fn(async () => ({ token: "eyJ-fake-token-0123456789", region: "southeastasia", expiresInSeconds: 600 }));
    let now = 0;
    const port = createAzureSpeech({ fallback: createFakeSpeech(), loadSdk: async () => fakeSdk().sdk, getToken, hasMicrophone: true, now: () => now });
    port.speak(["One."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd: vi.fn() });
    await flush();
    port.speak(["Two."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd: vi.fn() });
    await flush();
    expect(getToken).toHaveBeenCalledTimes(1);
    now = 541_000;
    port.speak(["Three."], { lang: "en-US", voice: AZURE_VOICES[0] ?? null }, { onEnd: vi.fn() });
    await flush();
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});
