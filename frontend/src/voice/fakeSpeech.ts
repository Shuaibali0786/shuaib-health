// A scripted SpeechPort for tests and end-to-end runs (Feature 013): no microphone, no speaker, no browser
// speech. A test "hears" words with `hear()` and decides when each spoken sentence "finishes".

import type { ListenHandlers, SpeakHandlers, SpeakOptions, SpeechPort, VoiceInfo } from "./types";

export interface FakeSpeech extends SpeechPort {
  /** Every sentence spoken, in order (cancelled ones included, marked by `cancelled`). */
  readonly spoken: Array<{ text: string; cancelled: boolean; lang: string; voice: string | null }>;
  /** The speaking rate of every sentence spoken. */
  readonly spokenRates: number[];
  readonly listening: boolean;
  readonly listenLang: string | null;
  /** The sentence being spoken right now, or null. */
  readonly speakingNow: string | null;
  /** The caller says something: interim words first (optional), then a final phrase. */
  hear(text: string, options?: { interim?: boolean }): void;
  /** Only interim words (the caller started talking but has not finished). */
  hearInterim(text: string): void;
  /** The current sentence finishes on its own. */
  finishSentence(): void;
  /** Finishes every queued sentence. */
  finishAll(): void;
  /** The browser reports an error. */
  fail(code: "denied" | "unavailable" | "silence" | "network"): void;
}

export function createFakeSpeech(options: { canListen?: boolean; canSpeak?: boolean; voices?: VoiceInfo[]; autoFinish?: boolean } = {}): FakeSpeech {
  const spoken: FakeSpeech["spoken"] = [];
  const spokenRates: number[] = [];
  let handlers: ListenHandlers | null = null;
  let lang: string | null = null;
  const queue: Array<{ text: string; index: number; run: { chunks: string[]; handlers: SpeakHandlers; finished: boolean } }> = [];

  const settle = (item: (typeof queue)[number], cancelled: boolean) => {
    const last = item.index === item.run.chunks.length - 1;
    if (cancelled && !item.run.finished) {
      item.run.finished = true;
      item.run.handlers.onEnd(true);
    } else if (!cancelled && last && !item.run.finished) {
      item.run.finished = true;
      item.run.handlers.onEnd(false);
    }
  };

  function start(next: (typeof queue)[number]) {
    next.run.handlers.onStart?.();
    next.run.handlers.onBoundary?.();
  }

  const port: FakeSpeech = {
    canListen: options.canListen ?? true,
    canSpeak: options.canSpeak ?? true,
    spoken,
    spokenRates,
    get listening() {
      return handlers !== null;
    },
    get listenLang() {
      return lang;
    },
    get speakingNow() {
      return queue[0]?.text ?? null;
    },
    listen(l, h) {
      lang = l;
      handlers = h;
    },
    stopListening() {
      handlers = null;
    },
    speak(chunks, o: SpeakOptions, h) {
      const run = { chunks, handlers: h, finished: false };
      for (let i = 0; i < chunks.length; i += 1) spokenRates.push(o.rate ?? 1);
      chunks.forEach((text, index) => {
        spoken.push({ text, cancelled: false, lang: o.lang, voice: o.voice?.name ?? null });
        queue.push({ text, index, run });
      });
      if (queue[0]?.run === run && queue[0].index === 0) start(queue[0]);
      if (options.autoFinish) queueMicrotask(() => port.finishAll());
    },
    cancelSpeech() {
      const items = queue.splice(0, queue.length);
      for (const item of items) {
        const record = spoken.find((s) => s.text === item.text && !s.cancelled);
        if (record) record.cancelled = true;
        settle(item, true);
      }
    },
    voices: () => Promise.resolve(options.voices ?? []),
    hear(text, o) {
      if (o?.interim) handlers?.onInterim(text);
      handlers?.onFinal(text);
    },
    hearInterim(text) {
      handlers?.onInterim(text);
    },
    finishSentence() {
      const item = queue.shift();
      if (!item) return;
      settle(item, false);
      const next = queue[0];
      if (next && next.run !== item.run) start(next);
      else if (next) next.run.handlers.onBoundary?.();
    },
    finishAll() {
      while (queue.length > 0) port.finishSentence();
    },
    fail(code) {
      handlers?.onError(code);
    },
  };
  return port;
}
