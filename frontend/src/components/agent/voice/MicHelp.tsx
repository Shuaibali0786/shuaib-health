"use client";

import { CircleAlert } from "lucide-react";

import type { Notice } from "@/voice/session";

type Copy = { title: string; body: string; steps?: string[]; action?: string };

const COPY: Record<Notice, Copy> = {
  mic_denied: {
    title: "The microphone is blocked",
    body: "Your browser or Windows is not letting this site use the microphone. In Microsoft Edge on Windows, try these steps in order:",
    steps: [
      "Click the padlock (or tune) icon at the left of the address bar, open Permissions for this site, set Microphone to Allow, then reload the page.",
      "Still blocked? Open Edge Settings, then Cookies and site permissions, then Microphone. Make sure \"Ask before accessing\" is on and this site is not in the Block list.",
      "Still blocked? Open Windows Settings, then Privacy & security, then Microphone. Turn on Microphone access and Let desktop apps access your microphone (Edge is a desktop app).",
      "Close other apps that may be using the microphone, such as Teams or Zoom, then tap Try again.",
    ],
    action: "Try again",
  },
  mic_unavailable: {
    title: "I can't reach a microphone",
    body: "The browser found no working microphone. Check these, then try again:",
    steps: [
      "Make sure a microphone or headset is plugged in and switched on.",
      "Open Windows Settings, then System, then Sound, and under Input choose your microphone.",
      "Close other apps that may be using it, such as Teams or Zoom.",
    ],
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
    // Edge on Windows often cannot reach its own listening service; Chrome's works. Until the premium voice is on.
    title: "Voice listening works most reliably in the Chrome browser",
    body: "This browser could not reach its listening service. You can also type below, and I will still answer aloud.",
    action: "Try again",
  },
  tap_to_talk: {
    title: "I stopped listening",
    body: "It was quiet for a while. Tap the button when you're ready to continue.",
    action: "Start listening",
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
        {copy.steps ? (
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5">
            {copy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        <p className="mt-1.5">You can also type your message below; I will still read my answers aloud.</p>
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
