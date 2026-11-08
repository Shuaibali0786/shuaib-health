"use client";

import { CircleAlert } from "lucide-react";

import type { Notice } from "@/voice/session";

const COPY: Record<Notice, { title: string; body: string; action?: string }> = {
  mic_denied: {
    title: "The microphone is blocked",
    body: "Click the lock icon next to the address bar, allow Microphone for this site, then try again. You can also type your message below; I will still read my answers aloud.",
    action: "Try again",
  },
  mic_unavailable: {
    title: "I can't reach a microphone",
    body: "Check that a microphone is connected and not in use by another app. You can type your message below.",
    action: "Try again",
  },
  listen_unsupported: {
    title: "This browser can't listen",
    body: "I can still speak my answers. Please type your questions below. Chrome or Edge works best for talking.",
  },
  speak_unsupported: {
    title: "This browser can't speak aloud",
    body: "I will show my answers as text instead.",
  },
  network: {
    title: "The speech service isn't reachable",
    body: "Your browser's listening service needs an internet connection. Check your connection, or type your message below.",
    action: "Try again",
  },
  tap_to_talk: {
    title: "I stopped listening",
    body: "It was quiet for a while. Tap the button when you're ready to continue.",
    action: "Start listening",
  },
  no_urdu_voice: {
    title: "No Urdu voice on this device",
    body: "I will show the text and read it in Roman Urdu with an English voice. Microsoft Edge on Windows has natural Urdu voices you can install.",
  },
};

/** A calm explanation, in plain words, for anything that stops the voice from working, with the way forward. */
export function MicHelp({ notice, onAction, onDismiss }: { notice: Notice | null; onAction: () => void; onDismiss: () => void }) {
  if (!notice) return null;
  const copy = COPY[notice];
  return (
    <div role="status" className="mx-3 flex gap-3 rounded-card border border-border-strong bg-surface p-3 text-sm text-ink">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-navy-900" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy-900">{copy.title}</p>
        <p className="mt-0.5">{copy.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {copy.action ? (
            <button type="button" onClick={onAction} className="min-h-11 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white">
              {copy.action}
            </button>
          ) : null}
          <button type="button" onClick={onDismiss} className="min-h-11 rounded-control border border-border-strong bg-white px-4 text-sm font-semibold text-navy-900">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
