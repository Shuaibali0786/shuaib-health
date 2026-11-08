// One voice conversation: turn-taking, barge-in, silence prompts and the safe "yes" gate (Feature 013).
//
// Framework-free on purpose, so it is tested end to end with a scripted SpeechPort. The React panel only draws
// what this emits. Audio is never recorded or stored here. The conversation's memory (the booking, the language)
// is the shared `Conversation`, so typed and spoken turns are one conversation.

import { cleanText, detectLang } from "@/agent/normalize";
import { createThrottle } from "@/agent/throttle";

import type { BookingState } from "./bookingDialog";
import { splitSentences } from "./chunk";
import { CHECKING, STILL_THERE, TAP_TO_TALK, T, welcomeLine } from "./phrases";
import type { Conversation, RouterResult } from "./router";
import { replyLanguage } from "./language";
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
};

const SILENCE_MS = 8000;
const ACK_AFTER_MS = 1000;
const ECHO_OVERLAP = 0.6;
const ECHO_MIN_WORDS = 4;
/** A little slower than the default: warmer, easier to follow. */
const SPEECH_RATE = 0.95;
const GREETING = /^(assalam|wa alaikum|salam)/i;

const words = (text: string) => cleanText(text).split(" ").filter(Boolean);

/** How much of what was heard is made of words the assistant itself just said (its own voice, coming back in). */
function overlap(heard: string, spoken: string): number {
  const h = words(heard);
  if (h.length === 0) return 0;
  const s = new Set(words(spoken));
  return h.filter((w) => s.has(w)).length / h.length;
}

export class VoiceSession {
  private readonly port: SpeechPort;
  private readonly events: SessionEvents;
  private readonly conversation: Conversation;
  // A booking by voice takes about ten turns, so the limit is wider than the typed chat's 8 a minute. It only stops runaway loops.
  private readonly throttle = createThrottle(Date.now, 24, 150);
  private readonly pauseMs: number;
  private readonly listenCode: string;
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
    this.listenCode = options.listenCode ?? "en-IN";
    if (!this.openingDone) this.conversation.ctx.lang = this.welcomeLang;
  }

  // --- Public controls ----------------------------------------------------------------------------------

  /** Welcome (once), then listen straight away. */
  async start(): Promise<void> {
    if (!this.port.canSpeak && !this.port.canListen) return;
    await this.loadVoices();
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
    this.port.listen(this.listenCode, {
      onInterim: (text) => this.onInterim(text),
      onFinal: (text) => this.onFinal(text),
      onError: (code) => this.onListenError(code),
    });
    this.armSilence();
  }

  private onInterim(text: string): void {
    this.silenceCount = 0;
    if (this.state === "speaking" || this.speaking > 0) {
      // Talking over the assistant stops it (barge-in). Its own voice coming back in must not.
      if (this.readBackActive) this.overlapped = true;
      if (words(text).length >= 2 && overlap(text, this.recent.join(" ")) < ECHO_OVERLAP) this.interrupt();
      return;
    }
    this.armSilence();
    this.events.onInterim(text);
  }

  private onFinal(text: string): void {
    this.silenceCount = 0;
    if (!text) return;
    if (this.state === "speaking" || this.speaking > 0) {
      if (this.readBackActive) this.overlapped = true;
      // Its own voice coming back in is a long run of its own words. A short answer ("11:30", "haan") is the patient
      // answering early, even if those words were just said: it cuts in and counts.
      if (words(text).length >= ECHO_MIN_WORDS && overlap(text, this.recent.join(" ")) >= ECHO_OVERLAP) return;
      this.interrupt();
    }
    void this.enqueueTurn(text, false);
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
  }

  // --- One turn -----------------------------------------------------------------------------------------

  private enqueueTurn(text: string, fromText: boolean): Promise<void> {
    this.chain = this.chain.then(() => this.runTurn(text, fromText)).catch(() => undefined);
    return this.chain;
  }

  private async runTurn(text: string, fromText: boolean): Promise<void> {
    if (this.ended || !text) return;
    const allowed = this.throttle.take();
    this.events.onTurn({ id: this.turnId++, from: "you", text, voice: !fromText });
    const lang = this.conversation.ctx.lang;
    // The first sentence decides the language and the voice, once. (The welcome used the English female voice.)
    await this.loadVoices();
    this.lockVoiceFrom(text);
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

  /** The best warm female voice for a language: an Urdu voice for Roman Urdu when the device has one, else an English one. */
  private pick(lang: VoiceLang): { info: VoiceInfo | null; lang: string; urdu: boolean } {
    const set = pickVoiceSet(this.voices, "female");
    const info = lang === "roman" ? (set.urdu ?? set.romanFallback ?? set.english) : (set.english ?? set.romanFallback ?? set.urdu);
    return { info, lang: info?.lang ?? (lang === "roman" ? "en-IN" : "en-US"), urdu: Boolean(info?.lang.toLowerCase().startsWith("ur")) };
  }

  /** From the caller's first sentence: choose the language and the one voice, and keep it for the whole conversation. */
  private lockVoiceFrom(text: string): void {
    if (this.voice) return;
    this.voice = this.pick(replyLanguage(text, "en"));
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
    // The welcome is spoken in the English female voice; after the caller's first sentence the chosen voice is used.
    const voice = this.voice ?? this.pick("en");
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;

    const generation = this.generation;
    if (options.readBack) {
      this.readBackActive = true;
      this.overlapped = false;
    }
    this.speaking += 1;
    this.clearSilence();
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
            this.recent = [...this.recent.slice(-3), sentence, clean];
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
    if (generation !== this.generation || this.ended) return; // an interruption already moved on
    this.events.onSpeaking(null);
    if (options.readBack) this.readBackActive = false;
    if (this.speaking > 0) return;
    if (options.keepIdle || this.stopped) {
      this.setState("idle");
      return;
    }
    this.beginListening();
  }

  private setState(state: VoiceState): void {
    if (this.state === state) return;
    this.state = state;
    this.events.onState(state);
  }
}
