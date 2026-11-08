"use client";

import { AudioLines, Mic, Send, X } from "lucide-react";
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { QUICK_REPLIES, welcomeMessage } from "@/agent/localEngine";
import { MAX_QUESTION } from "@/agent/normalize";
import { GUIDE_SUGGESTIONS } from "@/agent/productGuide";
import { getProvider, type ProviderId } from "@/agent/registry";
import { createThrottle } from "@/agent/throttle";
import type { AgentLink, AgentMode, KnowledgePack } from "@/agent/types";
import { cn } from "@/lib/cn";
import { createBrowserSpeech } from "@/voice/browserSpeech";
import { primeMicrophone, type MicResult } from "@/voice/microphone";
import type { Notice } from "@/voice/session";
import type { Turn } from "@/voice/types";

import { MicHelp } from "./voice/MicHelp";
import { useDictation } from "./voice/useDictation";
import type { VoicePrefs } from "./voice/VoiceMode";

// Voice mode (orb, controls, booking) loads only when someone asks for it, so the chat itself stays light.
const VoiceMode = lazy(() => import("./voice/VoiceMode"));

export const DEFAULT_VOICE_PREFS: VoicePrefs = { listenLang: "en", gender: "female", opened: false };

export type AssistantPanelProps = {
  pack: KnowledgePack;
  provider?: ProviderId;
  onClose: () => void;
  /** Feature 013 (VOICE_ENABLED): show the Mic and Voice mode buttons. Off by default. */
  voice?: boolean;
  /** Open straight into voice mode (the "Talk to us" bubble). */
  startInVoice?: boolean;
  /** Voice choices kept while the page stays open: language, voice, and whether the greeting was heard. */
  voicePrefs?: VoicePrefs;
  onVoicePrefs?: (next: Partial<VoicePrefs>) => void;
  /** The microphone request already made by the tap that opened voice mode (the bubble). */
  micCheck?: Promise<MicResult> | null;
};

type Message = { id: number; from: "you" | "assistant"; text: string; links?: AgentLink[] };

const GUIDE_GREETING = "Hello! I can show a clinic owner what this system includes and how it looks for your specialty.";
const greetingFor = (mode: AgentMode, pack: KnowledgePack) => (mode === "guide" ? GUIDE_GREETING : welcomeMessage(pack));

/**
 * The chat panel (Feature 010): a dialog with an optional Patient / Product guide switch (demo only), the
 * conversation (announced politely to screen readers), suggestion chips and a short input. The conversation
 * lives only in this component's memory: nothing is stored or sent anywhere.
 *
 * Feature 013 adds, behind a flag: a Mic button (dictation into the box) and a Voice mode button (the orb, live
 * captions and hands-free booking). Typed and spoken turns share this one conversation.
 */
export function AssistantPanel({ pack, provider: providerId = "local", onClose, voice = false, startInVoice = false, voicePrefs = DEFAULT_VOICE_PREFS, onVoicePrefs, micCheck: initialMicCheck = null }: AssistantPanelProps) {
  const provider = useMemo(() => getProvider(pack, providerId), [pack, providerId]);
  const throttle = useMemo(() => createThrottle(), []);
  const [mode, setMode] = useState<AgentMode>("patient");
  const [messages, setMessages] = useState<Message[]>(() => [{ id: 0, from: "assistant", text: welcomeMessage(pack) }]);
  const [suggestions, setSuggestions] = useState<string[]>(QUICK_REPLIES.en);
  const [draft, setDraft] = useState("");
  const [paused, setPaused] = useState(false);
  const [voiceOn, setVoiceOn] = useState(voice && startInVoice);
  const [micCheck, setMicCheck] = useState<Promise<MicResult> | null>(initialMicCheck);
  // What this browser can do. The panel only ever renders after a click (never on the server), so it is read once here.
  const [caps] = useState(() => {
    if (!voice) return { listen: false, speak: false };
    const port = createBrowserSpeech();
    return { listen: port.canListen, speak: port.canSpeak };
  });
  const [dictationNotice, setDictationNotice] = useState<Notice | null>(null);
  const next = useRef(1);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const voiceSubmit = useRef<((text: string) => void) | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const titleId = useId();
  const prefs = voicePrefs;
  const setPrefs = (patch: Partial<VoicePrefs>) => onVoicePrefs?.(patch);

  useEffect(() => input.current?.focus(), []);
  // Escape closes the chat wherever focus is (the Send button disables itself after sending).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, voiceOn]);

  const dictation = useDictation({ lang: prefs.listenLang, getDraft: () => draftRef.current, setDraft, onNotice: setDictationNotice });

  function push(message: Omit<Message, "id">) {
    const id = next.current++;
    setMessages((list) => [...list, { ...message, id }]);
  }

  function switchMode(to: AgentMode) {
    if (to === mode) return;
    setMode(to);
    setMessages([{ id: next.current++, from: "assistant", text: greetingFor(to, pack) }]);
    setSuggestions(to === "guide" ? GUIDE_SUGGESTIONS : QUICK_REPLIES.en);
  }

  async function ask(question: string) {
    const text = question.trim().slice(0, MAX_QUESTION);
    if (!text || paused) return;
    // In voice mode a typed message is one more turn of the same spoken conversation (the text fallback).
    if (voiceOn && voiceSubmit.current) {
      voiceSubmit.current(text);
      setDraft("");
      return;
    }
    const allowed = throttle.take();
    if (!allowed.ok) {
      push({ from: "assistant", text: allowed.reason === "session" ? "That is the question limit for this visit. Please reload the page or contact the clinic." : "Please wait a moment before asking again." });
      if (allowed.reason === "minute") {
        setPaused(true);
        window.setTimeout(() => setPaused(false), Math.min(allowed.retryInMs, 60_000));
      }
      return;
    }
    push({ from: "you", text });
    setDraft("");
    const reply = await provider.answer({ mode, question: text });
    push({ from: "assistant", text: reply.text, links: reply.links });
    setSuggestions(reply.suggestions ?? []);
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  function onVoiceTurn(turn: Turn) {
    push({ from: turn.from, text: turn.text, links: turn.links });
  }

  const showMic = voice && caps.listen;
  const showVoice = voice && (caps.listen || caps.speak);

  const renderLog = (extras?: ReactNode): ReactNode => (
    <div ref={log} className="min-h-[6.5rem] flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((message) => (
        <div key={message.id} className={cn("flex", message.from === "you" ? "justify-end" : "justify-start")}>
          <div className={cn("max-w-[85%] rounded-card px-3.5 py-2.5 text-sm", message.from === "you" ? "bg-navy-900 text-white" : "border border-border bg-surface text-ink")}>
            <span className="sr-only">{message.from === "you" ? "You: " : "Assistant: "}</span>
            <p>{message.text}</p>
            {message.links?.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {message.links.map((link) => (
                  <li key={link.href}>
                    {/* A plain anchor: no prefetch, so a link to the staff app never loads its code here. */}
                    <a href={link.href} className="inline-flex min-h-9 items-center rounded-pill border border-teal-700 bg-white px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ))}
      {extras}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cn(
        "assistant-panel fixed z-50 flex flex-col overflow-hidden border border-border bg-white shadow-lift",
        voiceOn
          ? "inset-0 h-dvh md:inset-auto md:right-6 md:bottom-6 md:h-[min(48rem,94dvh)] md:w-[26rem] md:rounded-card"
          : "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card md:inset-x-auto md:right-6 md:bottom-6 md:w-[24rem] md:rounded-card",
      )}
    >
      <div className="flex items-center gap-3 border-b-2 border-gold-300 bg-navy-900 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold text-white">
            Ask {pack.clinic.name}
          </h2>
          <p className="text-xs text-white/80">{voiceOn ? "Voice mode · an AI for a demo clinic · audio is never recorded" : "Instant answers from the clinic's own information"}</p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-control hover:bg-white/10" aria-label="Close chat">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {pack.demo ? (
        <div className="flex gap-1 border-b border-border bg-surface p-1.5" role="group" aria-label="Who is asking">
          {(["patient", "guide"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn("min-h-11 flex-1 rounded-control text-sm font-semibold", mode === m ? "bg-white text-navy-900 shadow-soft" : "text-muted hover:text-navy-900")}
            >
              {m === "patient" ? "Patient" : "Clinic owner"}
            </button>
          ))}
        </div>
      ) : null}

      {voiceOn ? (
        <Suspense fallback={<div className="flex-1 p-6 text-center text-sm text-ink">Starting voice mode…</div>}>
          <VoiceMode
            key={mode}
            pack={pack}
            mode={mode}
            provider={provider}
            prefs={prefs}
            onPrefs={setPrefs}
            onTurn={onVoiceTurn}
            onEnd={() => {
              setVoiceOn(false);
              input.current?.focus();
            }}
            registerSubmit={(fn) => {
              voiceSubmit.current = fn;
            }}
            micCheck={micCheck}
            onChangeRequest={() => input.current?.focus()}
            renderLog={renderLog}
          />
        </Suspense>
      ) : (
        <>
          {renderLog()}
          {suggestions.length ? (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Suggested questions">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => void ask(s)} disabled={paused} className="min-h-11 shrink-0 rounded-pill border border-border bg-white px-3 text-sm whitespace-nowrap text-navy-900 hover:bg-surface disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {!voiceOn && dictationNotice ? (
        <div className="pb-2">
          <MicHelp notice={dictationNotice} onAction={() => { setDictationNotice(null); dictation.toggle(); }} onDismiss={() => setDictationNotice(null)} />
        </div>
      ) : null}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-3 py-3">
        <label htmlFor={`${titleId}-q`} className="sr-only">
          Your question
        </label>
        <input
          ref={input}
          id={`${titleId}-q`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_QUESTION}
          autoComplete="off"
          placeholder={paused ? "One moment…" : dictation.active ? "Listening… speak now" : voiceOn ? "Or type here if you prefer" : "Type your question"}
          disabled={paused}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border-strong px-3 text-base text-ink"
        />
        {showMic && !voiceOn ? (
          <button
            type="button"
            onClick={dictation.toggle}
            aria-pressed={dictation.active}
            aria-label={dictation.active ? "Stop dictation" : "Dictate your question with the microphone"}
            className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-border-strong", dictation.active ? "bg-teal-700 text-white" : "bg-white text-navy-900 hover:bg-surface")}
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        {showVoice && !voiceOn ? (
          <button
            type="button"
            onClick={() => {
              // Ask for the microphone right here, in the tap, so the browser shows its permission prompt.
              setMicCheck(primeMicrophone());
              setVoiceOn(true);
            }}
            aria-label="Start voice mode, talk with the assistant" className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-navy-900 text-teal-300">
            <AudioLines className="size-5" aria-hidden="true" />
          </button>
        ) : null}
        <button type="submit" disabled={paused || !draft.trim()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-navy-900 text-white disabled:opacity-50" aria-label="Send">
          <Send className="size-5" aria-hidden="true" />
        </button>
      </form>
      <p className="bg-surface px-4 py-2 text-center text-xs text-ink">
        Portfolio demo — not a real clinic, not medical advice. This is a demo: please use sample details only, never your real personal or medical information.
      </p>
    </div>
  );
}
