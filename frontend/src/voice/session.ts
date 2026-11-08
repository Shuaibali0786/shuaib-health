// One voice conversation: turn-taking, barge-in, silence prompts and the safe "yes" gate (Feature 013).
//
// Framework-free on purpose, so it is tested end to end with a scripted SpeechPort. The React panel only draws
// what this emits. Audio is never recorded or stored here. The conversation's memory (the booking, the language)
// is the shared `Conversation`, so typed and spoken turns are one conversation.

import { detectLang } from "@/agent/normalize";
import { createThrottle } from "@/agent/throttle";

import type { BookingState } from "./bookingDialog";
import { splitSentences } from "./chunk";
import { CHECKING, STILL_THERE, TAP_TO_TALK, T, welcomeLine } from "./phrases";
import type { Conversation, RouterResult } from "./router";
import { urduToLatin } from "./language";
import { forSpeech } from "./speechText";
import type { SpeechPort, Turn, VoiceInfo, VoiceLang, VoiceState } from "./types";
import { urduSpeech } from "./urduSpeech";
import { pickVoiceSet } from "./voicePicker";

export type Notice = "mic_denied" | "mic_unavailable" | "listen_unsupported" | "speak_unsupported" | "network" | "tap_to_talk";

export type SessionEvents = {
  onState(state: VoiceState): void;
  /** The caller's words so far, while they are still talking. */
  onInterim(text: string): void;
  /** A finished turn, to be added to the chat history. */
  onTurn(turn: Turn): void;
  /** The sentence being spoken right now (for captions under the orb), or null. */
  onSpeaking(sentence: string | null): void;
  /** A word was spoken: pulse the orb's waves. */
  onBoundary(): void;
  /** Whatever the turn changed: the booking card and the slip card read this. */
  onResult(result: RouterResult): void;
  onNotice(notice: Notice): void;
};

export type SessionOptions = {
  port: SpeechPort;
  conversation: Conversation;
  events: SessionEvents;
  /** The language of the welcome, and so of the one voice used for the whole conversation. */
  welcomeLang?: VoiceLang;
  /** Skip the welcome (the caller already heard it in this conversation). */
  skipOpening?: boolean;
  /** A short rest between sentences, in milliseconds (default 220). Zero in tests. */
  pauseMs?: number;
  /** What the browser listens for. Indian English hears English and Roman Urdu (spoken Hinglish) best. */
  listenCode?: string;
  /**
   * How long the patient may pause mid-sentence before the turn is taken as finished (default 1300 ms). Listening
   * splits a sentence at short pauses; joining the pieces is what "waiting for the patient to finish" means. Zero in tests.
   */
  endOfTurnMs?: number;
  /** A short rest after the assistant stops speaking before the mic opens again, so its last word is not heard (default 400 ms). */
  resumeMs?: number;
};

const SILENCE_MS = 9000;
const ACK_AFTER_MS = 1000;
const ECHO_OVERLAP = 0.7;
const ECHO_MIN_WORDS = 4;
/** Its own voice can come back a moment after it stopped (room echo, a slow recogniser). */
const ECHO_WINDOW_MS = 8000;
/** A little slower than the default: warmer, easier to follow. */
const SPEECH_RATE = 0.95;
const GREETING = /^(assalam|wa alaikum|salam)/i;

/** Words in any script (Urdu letters kept), lower case, without punctuation. */
const scriptWords = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);

/**
 * True when a heard phrase is the assistant's own recent speech coming back through the mic: compared as heard
 * (Urdu letters against the Urdu the voice read) and in Latin letters (against the Roman Urdu caption), so "معاف
 * کیجیے" heard after "Maaf kijiye" is caught too. Short answers ("haan", "11:30") are never treated as an echo.
 */
export function isEcho(heard: string, recent: string[]): boolean {
  const count = scriptWords(heard).length;
  if (count < ECHO_MIN_WORDS || recent.length === 0) return false;
  // A loose match per word: Urdu letters written back in English letters lose their vowels ("کیجیے" -> "kijie",
  // "سن" -> "sn", "میں" -> "mein" for "main"), so words are compared by their consonants.
  const skeleton = (w: string) => w.replace(/[aeiouyhw]/g, "") || w;
  const same = (a: string, b: string) => a === b || skeleton(a) === skeleton(b);
  const covered = (h: string[], s: string[]) => {
    // Words of what was heard that sit in a run of 3+ words said in the same order by the assistant.
    const mark = new Array<boolean>(h.length).fill(false);
    for (let i = 0; i < h.length; i += 1) {
      for (let j = 0; j < s.length; j += 1) {
        let k = 0;
        while (i + k < h.length && j + k < s.length && same(h[i + k] as string, s[j + k] as string)) k += 1;
        if (k >= 3) for (let x = 0; x < k; x += 1) mark[i + x] = true;
      }
    }
    return mark.filter(Boolean).length / Math.max(1, h.length);
  };
  const h = scriptWords(heard);
  const hLatin = scriptWords(urduToLatin(heard));
  // Each sentence on its own, and all of them in order (an echo often runs across two sentences).
  return [...recent, recent.join(" ")].some((said) => {
    const s = scriptWords(said);
    const sLatin = scriptWords(urduToLatin(said));
    const share = Math.max(covered(h, s), covered(hLatin, sLatin), covered(hLatin, s));
    // A short phrase must be ALL its own words to count ("haan spelling theek hai" is the patient answering).
    return count <= 5 ? share >= 1 : share >= ECHO_OVERLAP;
  });
}

export class VoiceSession {
  private readonly port: SpeechPort;
  private readonly events: SessionEvents;
  private readonly conversation: Conversation;
  // A booking by voice takes about ten turns, so the limit is wider than the typed chat's 8 a minute. It only stops runaway loops.
  private readonly throttle = createThrottle(Date.now, 24, 150);
  private readonly pauseMs: number;
  private readonly endOfTurnMs: number;
  private readonly resumeMs: number;
  /** Pieces of the patient's sentence heard so far (listening splits at short pauses); sent as one turn. */
  private pending: string[] = [];
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  /** When the assistant last finished speaking (for the echo window). */
  private spokeUntil = 0;
  /** The language the browser listens in: English first, Urdu (ur-PK) once the caller speaks Urdu or English listening hears nonsense. */
  private listenLang: string;
  /** The listening language was already switched since the last understood turn (switch once, then ask again). */
  private switchedSinceUnderstood = false;
  private readonly welcomeLang: VoiceLang;

  private state: VoiceState = "idle";
  private ended = false;
  private stopped = false;
  private voices: VoiceInfo[] = [];
  private voicesPromise: Promise<void> | null = null;
  /** The one voice for the whole conversation: chosen from the caller's first sentence, then never switched. */
  private voice: { info: VoiceInfo | null; lang: string; urdu: boolean } | null = null;
  private turnId = 1;

  /** Bumped by every interruption: speech started before it stops at the next sentence. */
  private generation = 0;
  private speaking = 0;
  private recent: string[] = [];
  private chain: Promise<void> = Promise.resolve();

  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceCount = 0;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while the assistant is speaking a read-back (or a re-ask), until it has finished uncancelled. */
  private readBackActive = false;
  /** The caller spoke during the read-back (or cut it off): a "yes" from that turn must not book. */
  private overlapped = false;
  private openingDone: boolean;

  constructor(options: SessionOptions) {
    this.port = options.port;
    this.events = options.events;
    this.conversation = options.conversation;
    this.welcomeLang = options.welcomeLang ?? "en";
    this.openingDone = Boolean(options.skipOpening);
    this.pauseMs = options.pauseMs ?? 220;
    this.endOfTurnMs = options.endOfTurnMs ?? 1300;
    this.resumeMs = options.resumeMs ?? 400;
    this.listenLang = options.listenCode ?? "en-US";
    if (!this.openingDone) this.conversation.ctx.lang = this.welcomeLang;
  }

  // --- Public controls ----------------------------------------------------------------------------------

  /** Welcome (once), then listen straight away. */
  async start(): Promise<void> {
    if (!this.port.canSpeak && !this.port.canListen) return;
    await this.loadVoices();
    // One warm female voice for the whole call, chosen now (before the welcome) and never switched.
    this.voice ??= this.pickOne(this.welcomeLang);
    if (!this.port.canListen) this.events.onNotice("listen_unsupported");
    if (!this.openingDone) {
      this.openingDone = true;
      await this.say(welcomeLine(this.conversation.ctx.pack, this.welcomeLang), { assistantTurn: true });
      return; // speaking ends in beginListening()
    }
    this.beginListening();
  }

  stop(): void {
    this.ended = true;
    this.generation += 1;
    this.clearTimers();
    this.port.cancelSpeech();
    this.port.stopListening();
    this.events.onSpeaking(null);
    this.setState("idle");
  }

  /** The one mic button: tap to talk, tap again to stop. While the assistant speaks, a tap cuts in and listens. */
  toggleMic(): void {
    if (this.state === "speaking" || this.speaking > 0) {
      this.interrupt();
      return;
    }
    if (this.state === "listening") {
      this.stopped = true;
      this.port.stopListening();
      this.clearTimers();
      this.setState("idle");
      return;
    }
    this.resume();
  }

  /** Starts listening again (after the caller stopped it, the quiet-time stop, or a microphone problem was fixed). */
  resume(): void {
    this.stopped = false;
    this.silenceCount = 0;
    this.beginListening();
  }

  /** Stops the assistant mid-sentence and listens (the caller talking over it, or a tap on the mic). */
  interrupt(): void {
    if (this.speaking === 0 && this.state !== "speaking") return;
    this.generation += 1;
    if (this.readBackActive) this.overlapped = true;
    this.readBackActive = false;
    this.port.cancelSpeech();
    this.events.onSpeaking(null);
    this.speaking = 0;
    this.stopped = false;
    this.beginListening();
  }

  /** A typed message from the panel's text box (the text fallback). It counts as the caller's own turn. */
  submitText(text: string): void {
    if (this.state === "speaking") this.interrupt();
    this.silenceCount = 0;
    void this.enqueueTurn(text.trim(), true);
  }

  get booking(): BookingState | null {
    return this.conversation.ctx.booking;
  }

  get currentState(): VoiceState {
    return this.state;
  }

  // --- Listening ----------------------------------------------------------------------------------------

  private beginListening(): void {
    if (this.ended || this.stopped) return;
    if (!this.port.canListen) {
      this.setState("idle");
      return;
    }
    if (this.speaking > 0) return;
    this.setState("listening");
    this.listenNow();
    this.armSilence();
  }

  private listenNow(): void {
    this.port.listen(this.listenLang, {
      onInterim: (text) => this.onInterim(text),
      onFinal: (text) => this.onFinal(text),
      onError: (code) => this.onListenError(code),
    });
  }

  // The mic is closed while the assistant speaks (owner test 2026-11-08: it heard its own "Maaf kijiye" as
  // "معاف کیجیے" and answered itself in a loop). Anything that still arrives while it speaks is ignored; a tap on the
  // mic is how the patient cuts in.
  private onInterim(text: string): void {
    if (this.state === "speaking" || this.speaking > 0) return;
    this.silenceCount = 0;
    this.armSilence();
    // The patient is still talking: wait for them to finish before answering.
    if (this.endTimer) this.restartEndTimer();
    this.events.onInterim(urduToLatin([...this.pending, text].join(" ")));
  }

  private onFinal(text: string): void {
    if (!text || this.state === "speaking" || this.speaking > 0) return;
    // Its own voice coming back a moment after it stopped (in any script) is not the patient.
    if (Date.now() - this.spokeUntil < ECHO_WINDOW_MS && isEcho(text, this.recent)) return;
    this.silenceCount = 0;
    this.pending.push(text);
    if (this.endOfTurnMs <= 0) {
      this.flushPending();
      return;
    }
    this.events.onInterim(urduToLatin(this.pending.join(" ")));
    this.restartEndTimer();
  }

  private restartEndTimer(): void {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.flushPending(), this.endOfTurnMs);
  }

  /** The patient finished: their pieces become one turn. */
  private flushPending(): void {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    const text = this.pending.join(" ").replace(/\s+/g, " ").trim();
    this.pending = [];
    if (text) void this.enqueueTurn(text, false);
  }

  private onListenError(code: "denied" | "unavailable" | "silence" | "network"): void {
    if (code === "silence") return;
    this.port.stopListening();
    this.clearSilence();
    this.events.onNotice(code === "denied" ? "mic_denied" : code === "network" ? "network" : "mic_unavailable");
    this.setState("idle");
  }

  // --- Silence ------------------------------------------------------------------------------------------

  private armSilence(): void {
    this.clearSilence();
    if (this.ended || this.stopped || this.state !== "listening") return;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (this.ended || this.stopped || this.state !== "listening") return;
      this.silenceCount += 1;
      const lang = this.conversation.ctx.lang;
      if (this.silenceCount === 1) {
        void this.say(STILL_THERE(lang), { assistantTurn: false });
      } else {
        this.port.stopListening();
        this.stopped = true;
        this.events.onNotice("tap_to_talk");
        void this.say(TAP_TO_TALK(lang), { assistantTurn: false, keepIdle: true });
      }
    }, SILENCE_MS);
  }

  private clearSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private clearTimers(): void {
    this.clearSilence();
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.ackTimer = null;
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }

  // --- One turn -----------------------------------------------------------------------------------------

  private enqueueTurn(text: string, fromText: boolean): Promise<void> {
    this.chain = this.chain.then(() => this.runTurn(text, fromText)).catch(() => undefined);
    return this.chain;
  }

  private async runTurn(text: string, fromText: boolean): Promise<void> {
    if (this.ended || !text) return;
    const allowed = this.throttle.take();
    // The chat shows English letters only: what Urdu listening heard is written in Roman Urdu.
    this.events.onTurn({ id: this.turnId++, from: "you", text: urduToLatin(text), voice: !fromText });
    const lang = this.conversation.ctx.lang;
    await this.loadVoices();
    this.voice ??= this.pickOne(this.welcomeLang);
    if (!allowed.ok) {
      const wait =
        allowed.reason === "session"
          ? T(lang, "That is the question limit for this visit. Please reload the page or call the clinic.", "Is visit ke sawalon ki had poori ho gayi. Page dobara kholein ya clinic ko call karein.")
          : T(lang, "Please give me a moment before the next question.", "Agla sawal poochne se pehle zara intezaar karein.");
      await this.say(wait, { assistantTurn: true });
      return;
    }

    // The caller's turn is confirmable only if it did not overlap the read-back being spoken.
    const confirmable = fromText ? true : !this.overlapped;
    this.overlapped = false;

    this.clearSilence();
    this.setState("thinking");
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null;
      if (this.state === "thinking") void this.speak(CHECKING(this.conversation.ctx.lang), { readBack: false });
    }, ACK_AFTER_MS);

    let result: RouterResult;
    try {
      result = await this.conversation.turn(text, { confirmable });
    } catch {
      if (this.ackTimer) clearTimeout(this.ackTimer);
      this.ackTimer = null;
      await this.say(T(lang, "Sorry, something went wrong on my side. Please try again, or call the clinic.", "Maaf kijiye, mujh se kuch ghalat ho gaya. Dobara koshish karein ya clinic ko call karein."), { assistantTurn: true });
      return;
    }
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.ackTimer = null;
    if (this.ended) return;

    // Listening follows the caller's language: Roman Urdu or Urdu script switches to Urdu listening (ur-PK, which Chrome
    // supports). A spoken turn nothing could be made of usually means the wrong listening language ("CBC test karwana"
    // heard in English becomes "Qawwali"): switch once and ask again, instead of saying "I don't know".
    const garbled = !fromText && (result.intent === "unknown" || result.intent === "guide_unknown");
    if (garbled && !this.switchedSinceUnderstood) {
      const toUrdu = this.listenLang.startsWith("en");
      this.setListenLang(toUrdu ? "ur-PK" : "en-US");
      this.switchedSinceUnderstood = true;
      this.conversation.ctx.lang = toUrdu ? "roman" : "en";
      result = this.conversation.replaceLast({
        ...result,
        lang: this.conversation.ctx.lang,
        intent: "heard_again",
        links: undefined,
        spoken: undefined,
        text: toUrdu ? "Maaf kijiye, main theek se sun nahi saki. Dobara bataiye, aap Urdu mein bhi bol sakte hain." : "Sorry, I didn't catch that. Please say it again, in English or Urdu.",
      });
    } else if (!garbled) {
      this.switchedSinceUnderstood = false;
      if (result.lang === "roman" && this.listenLang.startsWith("en")) this.setListenLang("ur-PK");
    }
    this.events.onResult(result);
    if (result.urgent) {
      // An emergency stops everything else: cut off any acknowledgement and speak the number now.
      this.generation += 1;
      this.port.cancelSpeech();
      this.speaking = 0;
    }
    this.events.onTurn({ id: this.turnId++, from: "assistant", text: result.text, links: result.links, voice: true });
    await this.speak(result.spoken ?? result.text, { readBack: Boolean(result.readBack) });
  }

  // --- Speaking -----------------------------------------------------------------------------------------

  private loadVoices(): Promise<void> {
    this.voicesPromise ??= this.port
      .voices()
      .then((list) => {
        this.voices = list;
      })
      .catch(() => {
        this.voices = [];
      });
    return this.voicesPromise;
  }

  /**
   * The ONE warm female voice for the whole call. A South Asian English voice (Neerja, en-IN / en-PK) reads both
   * English and Roman Urdu naturally, so it comes first; an Urdu voice only when the call starts in Roman Urdu and
   * no such voice exists; otherwise the best English female voice.
   */
  private pickOne(lang: VoiceLang): { info: VoiceInfo | null; lang: string; urdu: boolean } {
    const set = pickVoiceSet(this.voices, "female");
    const southAsian = set.romanFallback && /^en-(in|pk)/i.test(set.romanFallback.lang) ? set.romanFallback : null;
    const info = southAsian ?? (lang === "roman" ? (set.urdu ?? set.english) : (set.english ?? set.urdu));
    return { info, lang: info?.lang ?? (lang === "roman" ? "en-IN" : "en-US"), urdu: Boolean(info?.lang.toLowerCase().startsWith("ur")) };
  }

  /** Shows a message in the chat and speaks it. */
  private async say(text: string, options: { assistantTurn: boolean; keepIdle?: boolean }): Promise<void> {
    if (options.assistantTurn) this.events.onTurn({ id: this.turnId++, from: "assistant", text, voice: true });
    await this.speak(text, { readBack: false, keepIdle: options.keepIdle });
  }

  private async speak(text: string, options: { readBack: boolean; keepIdle?: boolean }): Promise<void> {
    if (this.ended || !this.port.canSpeak) {
      if (!this.port.canSpeak && !this.ended) {
        this.events.onNotice("speak_unsupported");
        this.beginListening();
      }
      return;
    }
    await this.loadVoices();
    this.voice ??= this.pickOne(this.welcomeLang);
    const voice = this.voice;
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;

    const generation = this.generation;
    if (options.readBack) {
      this.readBackActive = true;
      this.overlapped = false;
    }
    this.speaking += 1;
    this.clearSilence();
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    // Never listen while speaking: the mic would hear the assistant's own voice.
    this.port.stopListening();
    if (this.endTimer) this.flushPending();
    this.setState("speaking");
    let cancelled = false;
    for (const [index, sentence] of sentences.entries()) {
      if (generation !== this.generation || this.ended) {
        cancelled = true;
        break;
      }
      const clean = forSpeech(sentence);
      // An Urdu voice reads Urdu script best, so a Roman Urdu sentence is rewritten for it (the caption stays Roman).
      const romanUrdu = GREETING.test(sentence) || detectLang(sentence) === "roman";
      const spoken = voice.urdu && romanUrdu ? urduSpeech(clean) : clean;
      cancelled = await new Promise<boolean>((resolve) => {
        this.port.speak([spoken], { lang: voice.lang, voice: voice.info, rate: SPEECH_RATE }, {
          onStart: () => {
            this.recent = [...this.recent.slice(-5), sentence, spoken];
            this.events.onSpeaking(sentence);
          },
          onBoundary: () => this.events.onBoundary(),
          onEnd: (wasCancelled) => resolve(wasCancelled),
        });
      });
      if (cancelled) break;
      // A short rest between sentences, like a person drawing breath.
      if (this.pauseMs > 0 && index < sentences.length - 1) await new Promise<void>((resolve) => setTimeout(resolve, this.pauseMs));
    }
    this.speaking = Math.max(0, this.speaking - 1);
    this.spokeUntil = Date.now();
    if (generation !== this.generation || this.ended) return; // an interruption already moved on
    this.events.onSpeaking(null);
    if (options.readBack) this.readBackActive = false;
    if (this.speaking > 0) return;
    if (options.keepIdle || this.stopped) {
      this.setState("idle");
      return;
    }
    // A short breath before the mic opens again, so the end of its own sentence is not heard.
    if (this.resumeMs <= 0) {
      this.beginListening();
      return;
    }
    // ("Listening..." is shown only once the mic is really open.)
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      if (this.speaking === 0) this.beginListening();
    }, this.resumeMs);
  }

  /** The language listening uses from the next time it starts (stopping now, so the switch takes effect right away). */
  private setListenLang(code: string): void {
    if (this.listenLang === code) return;
    this.listenLang = code;
    this.port.stopListening();
    if (this.state === "listening") {
      this.beginListening();
      return;
    }
    // While it thinks, the mic stays closed; it opens again (in the new language) after the reply is spoken.
  }

  /** The listening language now (for the panel and tests). */
  get listeningIn(): string {
    return this.listenLang;
  }

  private setState(state: VoiceState): void {
    if (this.state === state) return;
    this.state = state;
    this.events.onState(state);
  }
}
