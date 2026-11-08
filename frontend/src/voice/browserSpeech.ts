// The free browser speech adapter (Feature 013, research R1 and R2): the browser's own speech recognition and
// speech voices. Nothing is recorded or stored by this site, and no audio is sent to any service this product
// controls. A premium voice later is another SpeechPort chosen by configuration.

import type { ListenHandlers, SpeakHandlers, SpeakOptions, SpeechPort, VoiceInfo } from "./types";

// The parts of the Web Speech API this file uses (the DOM lib types are incomplete across browsers).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;
type SpeechWindow = {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

const RESTART_DELAY_MS = 250;
/** Chrome ends continuous recognition on silence or network blips. Restart quietly, but not in a tight loop. */
const MAX_QUICK_RESTARTS = 5;
const QUICK_MS = 1000;
const VOICES_WAIT_MS = 1500;

export function createBrowserSpeech(win: SpeechWindow | undefined = typeof window === "undefined" ? undefined : (window as unknown as SpeechWindow)): SpeechPort {
  const Recognizer = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
  const synth = win?.speechSynthesis;
  const Utterance = win?.SpeechSynthesisUtterance;
  const canSpeak = Boolean(synth && Utterance);

  let rec: Recognition | null = null;
  let wanted = false;
  let quickRestarts = 0;
  let startedAt = 0;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let pending = 0;
  let cancelledRun = false;

  function begin(lang: string, handlers: ListenHandlers) {
    if (!Recognizer) return;
    const r = new Recognizer();
    rec = r;
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0].transcript;
        if (result.isFinal) handlers.onFinal(text.trim());
        else interim += text;
      }
      if (interim.trim()) handlers.onInterim(interim.trim());
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wanted = false;
        handlers.onError("denied");
      } else if (event.error === "audio-capture") {
        wanted = false;
        handlers.onError("unavailable");
      } else if (event.error === "network") {
        handlers.onError("network");
      } else if (event.error === "no-speech") {
        handlers.onError("silence");
      }
      // "aborted" is us stopping; anything else is retried by onend below.
    };
    r.onend = () => {
      if (!wanted || rec !== r) return;
      const lived = Date.now() - startedAt;
      quickRestarts = lived < QUICK_MS ? quickRestarts + 1 : 0;
      if (quickRestarts > MAX_QUICK_RESTARTS) {
        wanted = false;
        handlers.onError("unavailable");
        return;
      }
      restartTimer = (win?.setTimeout ?? setTimeout)(() => {
        if (wanted) begin(lang, handlers);
      }, RESTART_DELAY_MS);
    };
    startedAt = Date.now();
    try {
      r.start();
    } catch {
      // start() throws if a session is already running; the running one keeps going.
    }
  }

  return {
    canListen: Boolean(Recognizer),
    canSpeak,

    listen(lang, handlers) {
      if (!Recognizer) {
        handlers.onError("unavailable");
        return;
      }
      wanted = true;
      quickRestarts = 0;
      if (rec) {
        rec.onend = null;
        rec.abort();
      }
      begin(lang, handlers);
    },

    stopListening() {
      wanted = false;
      if (restartTimer) (win?.clearTimeout ?? clearTimeout)(restartTimer);
      restartTimer = null;
      const r = rec;
      rec = null;
      if (r) {
        r.onend = null;
        r.onresult = null;
        try {
          r.abort();
        } catch {
          // already stopped
        }
      }
    },

    speak(chunks: string[], options: SpeakOptions, handlers: SpeakHandlers) {
      if (!synth || !Utterance || chunks.length === 0) {
        handlers.onEnd(false);
        return;
      }
      cancelledRun = false;
      const all = synth.getVoices();
      const voice = options.voice ? all.find((v) => v.name === options.voice?.name && v.lang === options.voice?.lang) : undefined;
      let finished = false;
      const finish = (cancelled: boolean) => {
        if (finished) return;
        finished = true;
        handlers.onEnd(cancelled);
      };
      chunks.forEach((text, index) => {
        const u = new Utterance(text);
        u.lang = options.lang;
        if (voice) u.voice = voice;
        u.rate = options.rate ?? 1;
        u.pitch = 1;
        if (index === 0) u.onstart = () => handlers.onStart?.();
        u.onboundary = () => handlers.onBoundary?.();
        pending += 1;
        const done = (cancelled: boolean) => {
          pending = Math.max(0, pending - 1);
          if (cancelled || cancelledRun) finish(true);
          else if (index === chunks.length - 1) finish(false);
        };
        u.onend = () => done(false);
        u.onerror = (event) => done(event.error === "canceled" || event.error === "interrupted");
        synth.speak(u);
      });
    },

    cancelSpeech() {
      if (!synth) return;
      cancelledRun = true;
      synth.cancel();
    },

    voices(): Promise<VoiceInfo[]> {
      const read = (): VoiceInfo[] => (synth?.getVoices() ?? []).map((v) => ({ name: v.name, lang: v.lang, local: v.localService }));
      if (!synth) return Promise.resolve([]);
      const now = read();
      if (now.length > 0) return Promise.resolve(now);
      return new Promise((resolve) => {
        const timer = (win?.setTimeout ?? setTimeout)(() => {
          synth.removeEventListener("voiceschanged", onChange);
          resolve(read());
        }, VOICES_WAIT_MS);
        const onChange = () => {
          (win?.clearTimeout ?? clearTimeout)(timer);
          synth.removeEventListener("voiceschanged", onChange);
          resolve(read());
        };
        synth.addEventListener("voiceschanged", onChange);
      });
    },
  };
}
