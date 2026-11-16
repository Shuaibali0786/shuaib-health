"use client";

import { Mic } from "lucide-react";

import { OPEN_VOICE_EVENT } from "@/components/agent/AssistantLauncher";

/**
 * The Home hero's second call to action (owner 2026-11-15): opens the AI receptionist straight into voice mode, the same
 * as the mic in the "Ask us" pill. It is only rendered when voice is on. Book Appointment stays the main button, so this
 * one is an outline button with a gold mic, never the filled accent colour.
 */
export function TalkToAyeshaButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_VOICE_EVENT))}
      aria-haspopup="dialog"
      data-testid="talk-to-ayesha"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-control border border-navy-900 bg-navy-900 py-1.5 pr-4 pl-1.5 text-left text-sm font-semibold text-white shadow-soft transition-colors duration-150 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-300 text-navy-900">
        <Mic className="size-4" aria-hidden="true" />
      </span>
      <span>
        Talk to Ayesha<span className="font-normal text-white/80"> — book in 60 seconds</span>
      </span>
    </button>
  );
}
