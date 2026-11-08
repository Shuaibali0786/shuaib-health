"use client";

import { MessageCircle, Mic } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { ProviderId } from "@/agent/registry";
import type { KnowledgePack } from "@/agent/types";

import type { AssistantPanelProps } from "./AssistantPanel";
import { primeMicrophone, type MicResult } from "@/voice/microphone";

import type { VoicePrefs } from "./voice/VoiceMode";

const DEFAULT_PREFS: VoicePrefs = { opened: false };

/**
 * The "Ask us" button (Feature 010). The panel, the engine and their styles are loaded only on the first click, so
 * pages that never open the chat pay for this small button only.
 *
 * Feature 013 (VOICE_ENABLED): ONE button, with the microphone clearly inside it (owner decision 2026-11-08: no
 * separate "Talk to us" bubble). "Ask us" opens the chat; the round mic inside opens it straight into voice mode
 * (the tap is also what lets the browser play sound and ask for the microphone).
 */
export function AssistantLauncher({ pack, provider = "local", voice = false, voiceProvider = "browser", voiceBrain = "rules" }: { pack: KnowledgePack; provider?: ProviderId; voice?: boolean; voiceProvider?: "browser" | "azure"; voiceBrain?: "rules" | "gemini" }) {
  const [Panel, setPanel] = useState<ComponentType<AssistantPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startInVoice, setStartInVoice] = useState(false);
  const [prefs, setPrefs] = useState<VoicePrefs>(DEFAULT_PREFS);
  const [micCheck, setMicCheck] = useState<Promise<MicResult> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // After the chat closes, focus goes back to the button (which is re-rendered once the panel is gone).
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [open]);

  async function show(inVoice = false) {
    // Ask for the microphone right now, inside the tap, so the browser's permission prompt comes from a real action.
    setMicCheck(inVoice ? primeMicrophone() : null);
    setStartInVoice(inVoice);
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
        <div className="assistant-dock fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6">
          <div className="inline-flex items-center gap-1 rounded-pill bg-navy-900 p-1 shadow-lift">
            <button
              ref={button}
              type="button"
              onClick={() => void show(false)}
              aria-haspopup="dialog"
              aria-busy={loading}
              className="assistant-launcher inline-flex min-h-11 items-center gap-2 rounded-pill pr-3 pl-4 font-semibold text-white hover:bg-white/10"
            >
              <MessageCircle className="size-5 text-gold-300" aria-hidden="true" />
              Ask us
            </button>
            {voice ? (
              <button
                type="button"
                onClick={() => void show(true)}
                aria-haspopup="dialog"
                aria-label="Talk by voice, in English or Urdu"
                title="Talk by voice (English / Urdu)"
                className="assistant-mic inline-flex size-11 items-center justify-center rounded-full bg-gold-300 text-navy-900 hover:bg-gold-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Mic className="size-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      )}
      {open && Panel ? (
        <Panel pack={pack} provider={provider} onClose={close} voice={voice} startInVoice={startInVoice} voicePrefs={prefs} onVoicePrefs={(patch) => setPrefs((p) => ({ ...p, ...patch }))} micCheck={micCheck} voiceProvider={voiceProvider} voiceBrain={voiceBrain} />
      ) : null}
    </>
  );
}
