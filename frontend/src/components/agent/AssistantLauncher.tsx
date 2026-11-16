"use client";

import { MessageCircle, Mic } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import type { ProviderId } from "@/agent/registry";
import type { KnowledgePack } from "@/agent/types";

import type { AssistantPanelProps } from "./AssistantPanel";
import { primeMicrophone, type MicResult } from "@/voice/microphone";

import type { VoicePrefs } from "./voice/VoiceMode";

const DEFAULT_PREFS: VoicePrefs = { opened: false };
/** Dispatched on `window` by the Home hero button to open the assistant straight into voice mode. */
export const OPEN_VOICE_EVENT = "assistant:open-voice";

/**
 * The "Ask us" button (Feature 010). The panel, the engine and their styles are loaded only on the first click, so
 * pages that never open the chat pay for this small button only.
 *
 * Feature 013 (VOICE_ENABLED): ONE button, with the microphone clearly inside it (owner decision 2026-11-08: no
 * separate "Talk to us" bubble). "Ask us" opens the chat; the round mic inside opens it straight into voice mode
 * (the tap is also what lets the browser play sound and ask for the microphone).
 */
export function AssistantLauncher({ pack, provider = "local", voice = false, voiceProvider = "browser", voiceBrain = "rules" }: { pack: KnowledgePack; provider?: ProviderId; voice?: boolean; voiceProvider?: "browser" | "azure"; voiceBrain?: "rules" | "gemini" | "openrouter" }) {
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

  // The home page's "Talk to Ayesha" button (a server-rendered page cannot reach this state) asks for voice mode with
  // a window event. It is dispatched inside the click, so the browser still counts it as the visitor's own tap.
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });
  useEffect(() => {
    if (!voice) return;
    const onOpen = () => void showRef.current(true);
    window.addEventListener(OPEN_VOICE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_VOICE_EVENT, onOpen);
  }, [voice]);
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
        // Owner B1 (2026-11-09). A floating pill always covers some button while a page scrolls (the device matrix found
        // day filters, test chips, department cards and "View profile" under it from 360 px to 1440 px). So:
        // - below 1700 px (phones, tablets, laptops) it is a slim glass pill at the bottom right (owner 2026-11-15: no solid
        //   white band, so the hero photo is never cut). The full-width bar ignores taps; only the pill takes them, and the
        //   page keeps the same room at the bottom (site layout), so the end of a page is never trapped under it;
        // - from 1700 px (owner real-device test 2026-11-14: not a tall vertical pill) it is the same horizontal pill,
        //   "Ask us" + mic side by side, floating bottom-right in the empty margin beside the page, so it never covers the
        //   hero photo or its cards.
        <div className="assistant-dock pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-end px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] min-[1700px]:inset-x-auto min-[1700px]:right-6 min-[1700px]:bottom-6 min-[1700px]:block min-[1700px]:p-0">
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-pill bg-navy-900/90 p-1 shadow-lift ring-1 ring-white/25 backdrop-blur-md">
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
