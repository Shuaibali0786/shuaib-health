// One voice conversation: turn-taking, barge-in, silence prompts and the safe "yes" gate (Feature 013).
//
// Framework-free on purpose, so it is tested end to end with a scripted SpeechPort. The React panel only draws
// what this emits. Audio is never recorded or stored here; the transcript lives in this object and is gone when
// the conversation ends.

import { cleanText } from "@/agent/normalize";
import { createThrottle } from "@/agent/throttle";
import type { AgentMode, AgentProvider, KnowledgePack } from "@/agent/types";
import type { AppointmentView } from "@/lib/booking/schemas";

import type { BookingState, DialogDeps } from "./bookingDialog";
import { splitSentences } from "./chunk";
import { CHECKING, NO_URDU_VOICE, STILL_THERE, TAP_TO_TALK, T, openingLines } from "./phrases";
import { routeTurn, type RouterContext, type RouterResult } from "./router";
import type { ListenLang, SpeechPort, Turn, VoiceGender, VoiceInfo, VoiceLang, VoiceState } from "./types";
import { pickVoice } from "./voicePicker";

export type Notice = "mic_denied" | "mic_unavailable" | "listen_unsupported" | "speak_unsupported" | "network" | "tap_to_talk" | "no_urdu_voice";

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
  /** The booking being collected, for the summary card (null when none). */
  onBooking(state: BookingState | null): void;
  onBooked(view: AppointmentView): void;
  onNotice(notice: Notice): void;
  onLang(lang: VoiceLang): void;
};

export type SessionOptions = {
  port: SpeechPort;
  pack: KnowledgePack;
  mode: AgentMode;
  provider: AgentProvider;
  deps: DialogDeps;
  events: SessionEvents;
  listenLang?: ListenLang;
  gender?: VoiceGender;
  /** Skip the greeting (the caller already heard it in this conversation). */
  skipOpening?: boolean;
};

const SILENCE_MS = 8000;
const ACK_AFTER_MS = 1000;
const ECHO_OVERLAP = 0.6;

const LISTEN_CODE: Record<ListenLang, string> = { en: "en-PK", ur: "ur-PK" };

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
  private readonly ctx: RouterContext;
  // A booking by voice takes about ten turns, so the limit is wider than the typed chat's 8 a minute. It only stops runaway loops.
  private readonly throttle = createThrottle(Date.now, 24, 150);

  private state: VoiceState = "idle";
  private muted = false;
  private ended = false;
  private listenLang: ListenLang;
  private gender: VoiceGender;
  private voices: VoiceInfo[] = [];
  private voicesLoaded = false;
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
  private noUrduNoted = false;
  private openingDone: boolean;

  constructor(options: SessionOptions) {
    this.port = options.port;
    this.events = options.events;
    this.listenLang = options.listenLang ?? "en";
    this.gender = options.gender ?? "female";
    this.openingDone = Boolean(options.skipOpening);
    this.ctx = { pack: options.pack, mode: options.mode, lang: "en", provider: options.provider, deps: options.deps, booking: null, offerDoctor: false, bookingsMade: 0 };
  }

  // --- Public controls ----------------------------------------------------------------------------------

  async start(): Promise<void> {
    if (!this.port.canSpeak && !this.port.canListen) return;
    await this.loadVoices();
    if (!this.port.canListen) this.events.onNotice("listen_unsupported");
    if (!this.openingDone) {
      this.openingDone = true;
      await this.say(openingLines(this.ctx.pack, this.ctx.lang), { assistantTurn: true });
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

  /** Stops the assistant mid-sentence and listens (the Interrupt button, or the caller talking over it). */
  interrupt(): void {
    if (this.speaking === 0 && this.state !== "speaking") return;
    this.generation += 1;
    if (this.readBackActive) this.overlapped = true;
    this.readBackActive = false;
    this.port.cancelSpeech();
    this.events.onSpeaking(null);
    this.speaking = 0;
    this.beginListening();
  }

  /** Starts listening again (after the quiet-time stop, or a microphone problem that was fixed). */
  resume(): void {
    this.muted = false;
    this.silenceCount = 0;
    this.beginListening();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.port.stopListening();
      this.clearTimers();
      this.setState("paused");
    } else {
      this.silenceCount = 0;
      this.beginListening();
    }
  }

  setListenLang(lang: ListenLang): void {
    this.listenLang = lang;
    if (this.state === "listening") this.beginListening(true);
  }

  setGender(gender: VoiceGender): void {
    this.gender = gender;
  }

  /** A typed message from the panel's text box (the text fallback). It counts as the caller's own turn. */
  submitText(text: string): void {
    if (this.state === "speaking") this.interrupt();
    this.silenceCount = 0;
    void this.enqueueTurn(text.trim(), true);
  }

  get booking(): BookingState | null {
    return this.ctx.booking;
  }

  get currentState(): VoiceState {
    return this.state;
  }

  // --- Listening ----------------------------------------------------------------------------------------

  private beginListening(restart = false): void {
    if (this.ended || this.muted) return;
    if (!this.port.canListen) {
      this.setState("idle");
      return;
    }
    if (this.speaking > 0) return;
    this.setState("listening");
    this.port.listen(LISTEN_CODE[this.listenLang], {
      onInterim: (text) => this.onInterim(text),
      onFinal: (text) => this.onFinal(text),
      onError: (code) => this.onListenError(code),
    });
    if (!restart || this.silenceTimer === null) this.armSilence();
  }

  private onInterim(text: string): void {
    this.silenceCount = 0;
    if (this.state === "speaking" || this.speaking > 0) {
      // Talking over the assistant. Its own voice coming back in must not interrupt it.
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
      if (overlap(text, this.recent.join(" ")) >= ECHO_OVERLAP) return; // its own voice, not the caller
      this.interrupt();
    }
    void this.enqueueTurn(text, false);
  }

  private onListenError(code: "denied" | "unavailable" | "silence" | "network"): void {
    if (code === "denied") {
      this.events.onNotice("mic_denied");
      this.setState("idle");
    } else if (code === "unavailable") {
      this.events.onNotice("mic_unavailable");
      this.setState("idle");
    } else if (code === "network") {
      this.events.onNotice("network");
    }
  }

  // --- Silence ------------------------------------------------------------------------------------------

  private armSilence(): void {
    this.clearSilence();
    if (this.ended || this.muted || this.state !== "listening") return;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      if (this.ended || this.muted || this.state !== "listening") return;
      this.silenceCount += 1;
      if (this.silenceCount === 1) {
        void this.say(STILL_THERE(this.ctx.lang), { assistantTurn: false });
      } else {
        this.port.stopListening();
        this.events.onNotice("tap_to_talk");
        void this.say(TAP_TO_TALK(this.ctx.lang), { assistantTurn: false, keepIdle: true });
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
    if (!allowed.ok) {
      const wait = T(this.ctx.lang, allowed.reason === "session" ? "That is the question limit for this visit. Please reload the page or call the clinic." : "Please give me a moment before the next question.", allowed.reason === "session" ? "Is visit ke sawalon ki had poori ho gayi. Page dobara kholein ya clinic ko call karein." : "Agla sawal poochne se pehle zara intezaar karein.");
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
      if (this.state === "thinking") void this.speak(CHECKING(this.ctx.lang), { readBack: false });
    }, ACK_AFTER_MS);

    let result: RouterResult;
    try {
      result = await routeTurn(this.ctx, { text, confirmable });
    } catch {
      if (this.ackTimer) clearTimeout(this.ackTimer);
      this.ackTimer = null;
      await this.say(T(this.ctx.lang, "Sorry, something went wrong on my side. Please try again, or call the clinic.", "Maaf kijiye, mujh se kuch ghalat ho gaya. Dobara koshish karein ya clinic ko call karein."), { assistantTurn: true });
      return;
    }
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.ackTimer = null;
    if (this.ended) return;

    this.ctx.booking = result.booking;
    this.ctx.offerDoctor = result.offerDoctor;
    if (result.lang !== this.ctx.lang) {
      this.ctx.lang = result.lang;
      this.events.onLang(result.lang);
    }
    this.events.onBooking(result.booking);
    if (result.booked) {
      this.ctx.bookingsMade += 1;
      this.events.onBooked(result.booked);
    }

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

  private async loadVoices(): Promise<void> {
    if (this.voicesLoaded) return;
    this.voicesLoaded = true;
    try {
      this.voices = await this.port.voices();
    } catch {
      this.voices = [];
    }
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
    const lang = this.ctx.lang;
    const pick = pickVoice(this.voices, { lang, listen: this.listenLang, gender: this.gender });
    let sentences = splitSentences(text);
    if (pick.urduVoiceMissing && !this.noUrduNoted) {
      this.noUrduNoted = true;
      this.events.onNotice("no_urdu_voice");
      sentences = [...splitSentences(NO_URDU_VOICE(lang)), ...sentences];
    }
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
    for (const sentence of sentences) {
      if (generation !== this.generation || this.ended) {
        cancelled = true;
        break;
      }
      cancelled = await new Promise<boolean>((resolve) => {
        this.port.speak([sentence], { lang: pick.langTag, voice: pick.voice }, {
          onStart: () => {
            this.recent = [...this.recent.slice(-1), sentence];
            this.events.onSpeaking(sentence);
          },
          onBoundary: () => this.events.onBoundary(),
          onEnd: (wasCancelled) => resolve(wasCancelled),
        });
      });
      if (cancelled) break;
    }
    this.speaking = Math.max(0, this.speaking - 1);
    if (generation !== this.generation || this.ended) return; // an interruption already moved on
    this.events.onSpeaking(null);
    if (options.readBack) this.readBackActive = false;
    if (this.speaking > 0) return;
    if (options.keepIdle) {
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
