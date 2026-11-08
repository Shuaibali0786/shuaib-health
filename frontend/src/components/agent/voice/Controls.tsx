"use client";

import { Hand, Mic, MicOff, PhoneOff } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ListenLang, VoiceGender, VoiceState } from "@/voice/types";

const BASE = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const QUIET = "border-border-strong bg-white text-navy-900 hover:bg-surface";

type Props = {
  state: VoiceState;
  muted: boolean;
  canListen: boolean;
  listenLang: ListenLang;
  gender: VoiceGender;
  onMute: (muted: boolean) => void;
  onInterrupt: () => void;
  onEnd: () => void;
  onListenLang: (lang: ListenLang) => void;
  onGender: (gender: VoiceGender) => void;
};

/**
 * The voice controls: Mute, Interrupt, End, the EN / اردو switch and the Female / Male voice. Every control is a
 * real button with a visible label or an accessible name, at least 44 px tall, and reachable by keyboard.
 */
export function Controls({ state, muted, canListen, listenLang, gender, onMute, onInterrupt, onEnd, onListenLang, onGender }: Props) {
  const speaking = state === "speaking";
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 px-3" role="group" aria-label="Voice controls">
      {canListen ? (
        <button type="button" aria-pressed={muted} onClick={() => onMute(!muted)} className={cn(BASE, muted ? "border-danger-700 bg-danger-50 text-danger-700" : QUIET)}>
          {muted ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
          {muted ? "Unmute" : "Mute"}
        </button>
      ) : null}
      <button type="button" onClick={onInterrupt} disabled={!speaking} className={cn(BASE, QUIET, "disabled:opacity-50")}>
        <Hand className="size-4" aria-hidden="true" />
        Interrupt
      </button>

      <div className="inline-flex rounded-pill border border-border-strong bg-white p-0.5" role="group" aria-label="Language">
        {(["en", "ur"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            aria-pressed={listenLang === lang}
            onClick={() => onListenLang(lang)}
            lang={lang === "ur" ? "ur" : "en"}
            className={cn("min-h-10 min-w-11 rounded-pill px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2", listenLang === lang ? "bg-navy-900 text-white" : "text-navy-900 hover:bg-surface")}
          >
            {lang === "en" ? "EN" : "اردو"}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-pill border border-border-strong bg-white p-0.5" role="group" aria-label="Voice style">
        {(["female", "male"] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={gender === g}
            onClick={() => onGender(g)}
            className={cn("min-h-10 rounded-pill px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2", gender === g ? "bg-navy-900 text-white" : "text-navy-900 hover:bg-surface")}
          >
            {g === "female" ? "Female" : "Male"}
          </button>
        ))}
      </div>

      <button type="button" onClick={onEnd} className={cn(BASE, "border-danger-700 bg-danger-700 text-white hover:bg-danger-700/90")}>
        <PhoneOff className="size-4" aria-hidden="true" />
        End
      </button>
    </div>
  );
}
