"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { MicResult } from "@/voice/microphone";
import type { Conversation, RouterResult } from "@/voice/router";
import { VoiceSession, type Notice } from "@/voice/session";
import { createSpeechPort } from "@/voice/speechPort";
import type { Turn, VoiceLang, VoiceState } from "@/voice/types";

import { Captions } from "./Captions";
import { MicHelp } from "./MicHelp";
import { Orb, type OrbHandle } from "./Orb";

export type VoicePrefs = { opened: boolean };

export type VoiceModeProps = {
  conversation: Conversation;
  /** The welcome's language, and so the one voice used for this conversation. */
  welcomeLang: VoiceLang;
  /** Use the premium voice provider (behind its own flag); it falls back to the browser silently. */
  provider: "browser" | "azure";
  prefs: VoicePrefs;
  onPrefs: (next: Partial<VoicePrefs>) => void;
  /** Every spoken or typed turn, so the chat history is one conversation (FR-003). */
  onTurn: (turn: Turn) => void;
  /** Whatever a turn changed (the booking card, the slip card). */
  onResult: (result: RouterResult) => void;
  /** End: leave voice mode (the chat stays open). */
  onEnd: () => void;
  /** Hands the panel a function that sends typed text into the voice conversation (the text fallback). */
  registerSubmit: (submit: ((text: string) => void) | null) => void;
  /** The microphone permission request made at the moment of the tap (so the prompt comes from a real action). */
  micCheck?: Promise<MicResult> | null;
  /** Draws the conversation log, with the cards inside it. */
  renderLog: (extras?: ReactNode, options?: { hidden?: boolean }) => ReactNode;
  /** The booking and slip cards, drawn inside the log. */
  cards: ReactNode;
};

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap the mic to talk",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  paused: "Tap the mic to talk",
};

/**
 * Voice mode inside the chat panel: the orb, the state, live captions, one big mic button and End. Everything else is
 * automatic: it listens after the welcome, the language follows the caller, and talking over the assistant stops it.
 * All of the talking logic lives in `VoiceSession`; this only draws what it reports.
 */
export default function VoiceMode({ conversation, welcomeLang, provider, prefs, onPrefs, onTurn, onResult, onEnd, registerSubmit, micCheck, renderLog, cards }: VoiceModeProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [caption, setCaption] = useState<string | null>(null);
  // The last line spoken stays as the caption (dimmed) until the next one, so the space under the orb never jumps.
  const [lastCaption, setLastCaption] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const orb = useRef<OrbHandle>(null);
  const session = useRef<VoiceSession | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const port = useMemo(() => createSpeechPort(provider), [provider]);
  // The latest callbacks, so the session (created once) never calls a stale one.
  const latest = useRef({ onTurn, onResult, onPrefs, registerSubmit });
  useEffect(() => {
    latest.current = { onTurn, onResult, onPrefs, registerSubmit };
  });
  const first = useRef({ opened: prefs.opened, micCheck: micCheck ?? null, welcomeLang });

  useEffect(() => {
    const s = new VoiceSession({
      port,
      conversation,
      welcomeLang: first.current.welcomeLang,
      skipOpening: first.current.opened,
      events: {
        onState: setState,
        onInterim: setInterim,
        onTurn: (turn) => {
          setInterim("");
          if (turn.from === "you" && turn.voice) setHeard(turn.text);
          latest.current.onTurn(turn);
        },
        onSpeaking: (sentence) => {
          setCaption(sentence);
          if (sentence) setLastCaption(sentence);
        },
        onBoundary: () => orb.current?.pulse(),
        onResult: (result) => latest.current.onResult(result),
        onNotice: setNotice,
      },
    });
    session.current = s;
    latest.current.registerSubmit((text) => s.submitText(text));
    latest.current.onPrefs({ opened: true });
    status.current?.focus();
    let cancelled = false;
    void (async () => {
      // The permission prompt was asked for at the tap; if it was refused, explain how to fix it, but still speak.
      const mic = first.current.micCheck ? await first.current.micCheck : "granted";
      if (cancelled) return;
      if (mic === "denied") setNotice("mic_denied");
      else if (mic === "unavailable") setNotice("mic_unavailable");
      await s.start();
    })();
    return () => {
      cancelled = true;
      s.stop();
      latest.current.registerSubmit(null);
      session.current = null;
    };
  }, [conversation, port]);

  // The written chat is hidden by default in voice mode: the caption under the orb is the only text (no duplicates).
  const [showChat, setShowChat] = useState(false);
  // While a help message, a booking card or the chat is on screen the orb shrinks so there is room for it.
  const compact = Boolean(notice) || Boolean(cards) || showChat;
  const listening = state === "listening";

  // Owner layout (2026-11-09): orb, ONE status pill, the caption (max 2 lines), "You said", then the two buttons with
  // clear space. Every row keeps its height and the block never shrinks or scrolls, so nothing can sit on the buttons;
  // the booking card and the choices live in the scrolling chat below.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="voice-mode">
      <section aria-label="Voice assistant" data-testid="voice-stage" className="flex shrink-0 flex-col items-center border-b border-border bg-linear-to-b from-teal-50 to-white px-2 pt-3 pb-4" data-compact={compact}>
        <Orb ref={orb} state={state} className={compact ? "h-[min(6.5rem,13dvh)] w-[min(6.5rem,13dvh)]" : "h-[min(11rem,22dvh)] w-[min(11rem,22dvh)]"} />
        <p ref={status} tabIndex={-1} role="status" aria-live="polite" data-testid="voice-status" className="mt-1 rounded-pill bg-white px-3 py-0.5 text-xs font-semibold tracking-wide text-navy-900 shadow-soft outline-none">
          {STATE_LABEL[state]}
        </p>
        <div className="mt-2 w-full">
          <Captions you={interim} assistant={caption ?? lastCaption} heard={heard} live={Boolean(caption)} />
        </div>
        <div data-testid="voice-controls" className="mt-3 flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={() => session.current?.toggleMic()}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : state === "speaking" ? "Interrupt and talk" : "Tap to talk"}
            className={cn(
              "inline-flex size-16 items-center justify-center rounded-full shadow-lift transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-900",
              listening ? "bg-teal-700 text-white ring-4 ring-teal-300" : "bg-navy-900 text-white",
            )}
          >
            {listening ? <Mic className="size-7" aria-hidden="true" /> : <MicOff className="size-7" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-danger-700 px-5 text-sm font-semibold text-white shadow-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy-900"
          >
            <PhoneOff className="size-5" aria-hidden="true" />
            End
          </button>
        </div>
        {notice ? (
          <div className="mt-3 max-h-[28dvh] w-full overflow-y-auto">
            <MicHelp
              notice={notice}
              onAction={() => {
                setNotice(null);
                session.current?.resume();
              }}
              onDismiss={() => setNotice(null)}
            />
          </div>
        ) : null}
      </section>
      {/* Below the controls: the cards (booking card, Open my slip, the phone and email boxes, choices) in their own
          scroll area, and the chat only when asked for. This area is clipped, so it can never cover the input row. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="voice-below">
        <div className="flex shrink-0 justify-center pt-1.5">
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            aria-expanded={showChat}
            className="min-h-9 rounded-pill px-3 text-xs font-semibold text-teal-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-navy-900"
          >
            {showChat ? "Hide chat" : "Show chat"}
          </button>
        </div>
        {showChat ? (
          renderLog(cards)
        ) : (
          <>
            {renderLog(null, { hidden: true })}
            <div data-testid="voice-cards" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-1 pb-3">
              {cards}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
