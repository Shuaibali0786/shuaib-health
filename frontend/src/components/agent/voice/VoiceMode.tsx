"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { AgentMode, AgentProvider, KnowledgePack } from "@/agent/types";
import { fetchSlots, postBooking } from "@/lib/booking/client";
import { createAttemptKey } from "@/lib/booking/idempotency";
import type { AppointmentView } from "@/lib/booking/schemas";
import type { BookingState, DialogDeps } from "@/voice/bookingDialog";
import { createBrowserSpeech } from "@/voice/browserSpeech";
import { VoiceSession, type Notice } from "@/voice/session";
import type { ListenLang, Turn, VoiceGender, VoiceState } from "@/voice/types";

import { Captions } from "./Captions";
import { Controls } from "./Controls";
import { MicHelp } from "./MicHelp";
import { Orb, type OrbHandle } from "./Orb";
import { SlipCard } from "./SlipCard";
import { SummaryCard } from "./SummaryCard";

export type VoicePrefs = { listenLang: ListenLang; gender: VoiceGender; opened: boolean };

export type VoiceModeProps = {
  pack: KnowledgePack;
  mode: AgentMode;
  provider: AgentProvider;
  prefs: VoicePrefs;
  onPrefs: (next: Partial<VoicePrefs>) => void;
  /** Every spoken or typed turn, so the chat history is one conversation (FR-003). */
  onTurn: (turn: Turn) => void;
  /** End: leave voice mode (the chat stays open). */
  onEnd: () => void;
  /** Hands the panel a function that sends typed text into the voice conversation (the text fallback). */
  registerSubmit: (submit: ((text: string) => void) | null) => void;
  /** "Change" on the summary card: put the cursor in the text box. */
  onChangeRequest: () => void;
  /** Draws the conversation log, with the cards inside it. */
  renderLog: (extras: ReactNode) => ReactNode;
};

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap the microphone to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking · talk or tap Interrupt to cut in",
  paused: "Microphone muted",
};

const SLOTS_TIMEOUT_MS = 10_000;

/**
 * Voice mode inside the chat panel: the orb, live captions and controls above the conversation, with the booking
 * summary and the slip drawn inside the conversation. All of the talking logic lives in `VoiceSession`; this only
 * draws what it reports. Loaded on demand, so pages and the chat itself stay light until someone asks for voice.
 */
export default function VoiceMode({ pack, mode, provider, prefs, onPrefs, onTurn, onEnd, registerSubmit, onChangeRequest, renderLog }: VoiceModeProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [caption, setCaption] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [booking, setBooking] = useState<BookingState | null>(null);
  const [booked, setBooked] = useState<AppointmentView | null>(null);
  const [muted, setMuted] = useState(false);
  const orb = useRef<OrbHandle>(null);
  const session = useRef<VoiceSession | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const port = useMemo(() => createBrowserSpeech(), []);
  // The latest callbacks, so the session (created once per mode) never calls a stale one.
  const latest = useRef({ onTurn, onPrefs, registerSubmit });
  useEffect(() => {
    latest.current = { onTurn, onPrefs, registerSubmit };
  });
  const first = useRef(prefs);

  useEffect(() => {
    const deps: DialogDeps = {
      pack,
      now: () => new Date(),
      fetchSlots: (slug) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SLOTS_TIMEOUT_MS);
        return fetchSlots(slug, controller.signal).finally(() => clearTimeout(timer));
      },
      submit: (payload, key) => postBooking(payload, key),
      newKey: createAttemptKey,
    };
    const s = new VoiceSession({
      port,
      pack,
      mode,
      provider,
      deps,
      listenLang: first.current.listenLang,
      gender: first.current.gender,
      skipOpening: first.current.opened,
      events: {
        onState: setState,
        onInterim: setInterim,
        onTurn: (turn) => {
          setInterim("");
          latest.current.onTurn(turn);
        },
        onSpeaking: setCaption,
        onBoundary: () => orb.current?.pulse(),
        onBooking: setBooking,
        onBooked: setBooked,
        onNotice: setNotice,
        onLang: () => undefined,
      },
    });
    session.current = s;
    latest.current.registerSubmit((text) => s.submitText(text));
    latest.current.onPrefs({ opened: true });
    void s.start();
    status.current?.focus();
    return () => {
      s.stop();
      latest.current.registerSubmit(null);
      session.current = null;
    };
  }, [pack, mode, provider, port]);

  const onMute = useCallback((next: boolean) => {
    setMuted(next);
    session.current?.setMuted(next);
  }, []);

  const retry = () => {
    setNotice(null);
    setMuted(false);
    session.current?.resume();
  };

  const extras = (
    <>
      {booking && booking.phase !== "booked" && booking.phase !== "failed" ? (
        <SummaryCard state={booking} pack={pack} onConfirm={() => session.current?.submitText("yes")} onChange={onChangeRequest} />
      ) : null}
      {booked ? <SlipCard view={booked} pack={pack} /> : null}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="voice-mode">
      <section aria-label="Voice assistant" className="flex shrink-0 flex-col items-center gap-1 border-b border-border bg-linear-to-b from-teal-50 to-white pt-2 pb-3">
        <Orb ref={orb} state={state} className="h-[min(17rem,30dvh)] w-[min(17rem,30dvh)]" />
        <p ref={status} tabIndex={-1} role="status" aria-live="polite" className="-mt-1 rounded-pill bg-white px-3 py-1 text-sm font-semibold text-navy-900 shadow-soft outline-none">
          {STATE_LABEL[state]}
        </p>
        <Captions you={interim} assistant={caption} />
        <MicHelp notice={notice} onAction={retry} onDismiss={() => setNotice(null)} />
        <Controls
          state={state}
          muted={muted}
          canListen={port.canListen}
          listenLang={prefs.listenLang}
          gender={prefs.gender}
          onMute={onMute}
          onInterrupt={() => session.current?.interrupt()}
          onEnd={onEnd}
          onListenLang={(lang) => {
            onPrefs({ listenLang: lang });
            session.current?.setListenLang(lang);
          }}
          onGender={(gender) => {
            onPrefs({ gender });
            session.current?.setGender(gender);
          }}
        />
      </section>
      {renderLog(extras)}
    </div>
  );
}
