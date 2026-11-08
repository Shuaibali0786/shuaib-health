"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { ProviderId } from "@/agent/registry";
import type { KnowledgePack } from "@/agent/types";

import type { AssistantPanelProps } from "./AssistantPanel";
import type { VoicePrefs } from "./voice/VoiceMode";

const DEFAULT_PREFS: VoicePrefs = { listenLang: "en", gender: "female", opened: false };
const BUBBLE_DELAY_MS = 1200;

/**
 * The gold "Ask us" button (Feature 010). The panel, the engine and their styles are loaded only on the
 * first click, so pages that never open the chat pay for this small button only.
 *
 * Feature 013 (VOICE_ENABLED): a small glowing bubble above the button, "Talk to us · English / اردو". It appears
 * a moment after the page loads, once per visit, and can be dismissed. Tapping it opens the chat straight into
 * voice mode (the tap is also what lets the browser play sound and ask for the microphone).
 */
export function AssistantLauncher({ pack, provider = "local", voice = false }: { pack: KnowledgePack; provider?: ProviderId; voice?: boolean }) {
  const [Panel, setPanel] = useState<ComponentType<AssistantPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startInVoice, setStartInVoice] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [prefs, setPrefs] = useState<VoicePrefs>(DEFAULT_PREFS);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // After the chat closes, focus goes back to the button (which is re-rendered once the panel is gone).
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [open]);

  // The discovery bubble appears shortly after load. It stays in this page's memory only: no storage.
  useEffect(() => {
    if (!voice) return;
    const timer = window.setTimeout(() => setBubble(true), BUBBLE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [voice]);

  async function show(inVoice = false) {
    setStartInVoice(inVoice);
    setBubble(false);
    setBubbleDismissed(true);
    if (!Panel) {
      setLoading(true);
      try {
        const mod = await import("./AssistantPanel");
        setPanel(() => mod.AssistantPanel);
      } finally {
        setLoading(false);
      }
    }
    setOpen(true);
  }

  function close() {
    returnFocus.current = true;
    setOpen(false);
  }

  return (
    <>
      {open ? null : (
        <div className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
          {voice && bubble && !bubbleDismissed ? (
            <div className="voice-bubble flex items-stretch rounded-card rounded-br-sm border border-teal-300 bg-white shadow-lift">
              <button type="button" onClick={() => void show(true)} className="min-h-11 rounded-l-card py-2 pr-2 pl-4 text-left text-sm font-semibold text-navy-900">
                Talk to us <span aria-hidden="true">·</span> English / <span lang="ur">اردو</span>
              </button>
              <button type="button" onClick={() => setBubbleDismissed(true)} aria-label="Dismiss the voice invitation" className="inline-flex min-h-11 w-11 items-center justify-center rounded-r-card text-ink hover:bg-surface">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <button
            ref={button}
            type="button"
            onClick={() => void show(false)}
            aria-haspopup="dialog"
            aria-busy={loading}
            className="assistant-launcher inline-flex min-h-12 items-center gap-2 rounded-pill bg-navy-900 px-5 font-semibold text-white shadow-lift"
          >
            <MessageCircle className="size-5 text-gold-300" aria-hidden="true" />
            Ask us
          </button>
        </div>
      )}
      {open && Panel ? (
        <Panel pack={pack} provider={provider} onClose={close} voice={voice} startInVoice={startInVoice} voicePrefs={prefs} onVoicePrefs={(patch) => setPrefs((p) => ({ ...p, ...patch }))} />
      ) : null}
    </>
  );
}
