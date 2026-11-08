// Contracts of the voice receptionist (Feature 013, Phase 1). Pure types: no browser access here, so the whole
// conversation can be tested with a scripted speech port (fakeSpeech.ts).

/** The language style of a reply. Phase 1: English or simple Roman Urdu (Urdu script is Phase 2). */
export type VoiceLang = "en" | "roman";
/** The EN / اردو toggle: which language the browser listens for. */
export type ListenLang = "en" | "ur";
export type VoiceGender = "female" | "male";
export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "paused";

export type VoiceInfo = { name: string; lang: string; local: boolean };

export type ListenHandlers = {
  /** Words heard so far in the current phrase (not final). */
  onInterim: (text: string) => void;
  /** A finished phrase. */
  onFinal: (text: string) => void;
  /** `denied` = microphone refused; `unavailable` = no microphone or no service; `silence` = nothing heard. */
  onError: (code: "denied" | "unavailable" | "silence" | "network") => void;
};

export type SpeakHandlers = {
  onStart?: () => void;
  /** Fires at each spoken word (when the browser reports it); drives the orb's waves. */
  onBoundary?: () => void;
  /** Called once after the last chunk, or after `cancelSpeech()` with `cancelled: true`. */
  onEnd: (cancelled: boolean) => void;
};

export type SpeakOptions = { lang: string; voice: VoiceInfo | null; /** 1 is normal speed; a little under 1 sounds warmer. */ rate?: number };

/**
 * Listening and speaking behind one door (research R6). Phase 1 has the browser adapter only. A premium voice
 * later is another adapter chosen by configuration; the conversation code does not change.
 */
export interface SpeechPort {
  readonly canListen: boolean;
  readonly canSpeak: boolean;
  listen(lang: string, handlers: ListenHandlers): void;
  stopListening(): void;
  speak(chunks: string[], options: SpeakOptions, handlers: SpeakHandlers): void;
  cancelSpeech(): void;
  voices(): Promise<VoiceInfo[]>;
}

export type Turn = { id: number; from: "you" | "assistant"; text: string; links?: Array<{ label: string; href: string }>; voice?: boolean };

/** A field of the booking being collected, with how sure we are of it. */
export type FieldStatus = "missing" | "heard" | "corrected";

export type BookingPhase = "collecting" | "read_back" | "awaiting_yes" | "submitting" | "booked" | "failed";

export type BookingDraft = {
  fullName: string | null;
  /** E.164, for example +923001234567. */
  phone: string | null;
  /** Digits heard so far when fewer than a full number came in; used to ask only for the rest. */
  phonePartial: string;
  reason: string | null;
  reasonAnswered: boolean;
  /** The lab test being booked (through the Pathology Lab doctor); the card, read-back and slip show it and its price. */
  labTestSlug: string | null;
  doctorSlug: string | null;
  departmentSlug: string | null;
  /** Clinic-local date, YYYY-MM-DD. */
  date: string | null;
  /** Clinic-local time, HH:MM. */
  time: string | null;
  /** The instant of the chosen free slot. Set only from a slot the server listed. */
  startsAt: string | null;
  email: string | null;
  emailAnswered: boolean;
  corrected: ReadonlyArray<keyof Pick<BookingDraft, "fullName" | "phone" | "reason" | "doctorSlug" | "date" | "time" | "email">>;
};

export const EMPTY_DRAFT: BookingDraft = {
  fullName: null,
  phone: null,
  phonePartial: "",
  reason: null,
  reasonAnswered: false,
  labTestSlug: null,
  doctorSlug: null,
  departmentSlug: null,
  date: null,
  time: null,
  startsAt: null,
  email: null,
  emailAnswered: false,
  corrected: [],
};
