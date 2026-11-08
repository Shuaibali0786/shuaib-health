"use client";

import { useId, useMemo } from "react";

import type { VoiceInfo } from "@/voice/types";
import { menuVoices, voiceLabel } from "@/voice/voicePicker";

const keyOf = (voice: VoiceInfo) => `${voice.name}|${voice.lang}`;
const isNatural = (voice: VoiceInfo) => /natural|online/i.test(voice.name);

type Props = {
  voices: VoiceInfo[];
  /** "" = Automatic, otherwise the key of the chosen voice. */
  selected: string;
  onSelect: (voice: VoiceInfo | null) => void;
  onSample: () => void;
};

/**
 * The Voice menu: every English, Urdu and Hindi voice this device offers (the natural ones first), so a voice can be
 * tried and kept. "Automatic" picks the warmest voices for each language. A native select, so it works by keyboard
 * and with screen readers.
 */
export function VoiceMenu({ voices, selected, onSelect, onSample }: Props) {
  const id = useId();
  const list = useMemo(() => menuVoices(voices), [voices]);
  if (list.length === 0) return null;
  const natural = list.filter(isNatural);
  const others = list.filter((voice) => !isNatural(voice));
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 px-3">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        Voice
      </label>
      <select
        id={id}
        value={selected}
        onChange={(event) => onSelect(list.find((voice) => keyOf(voice) === event.target.value) ?? null)}
        className="min-h-11 min-w-0 max-w-[15rem] flex-1 rounded-control border border-border-strong bg-white px-2 text-sm text-navy-900"
      >
        <option value="">Automatic (recommended)</option>
        {natural.length ? (
          <optgroup label="Natural voices">
            {natural.map((voice) => (
              <option key={keyOf(voice)} value={keyOf(voice)}>
                {voiceLabel(voice)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {others.length ? (
          <optgroup label="Other voices">
            {others.map((voice) => (
              <option key={keyOf(voice)} value={keyOf(voice)}>
                {voiceLabel(voice)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      <button type="button" onClick={onSample} className="min-h-11 rounded-control border border-border-strong bg-white px-3 text-sm font-semibold text-navy-900 hover:bg-surface">
        Hear a sample
      </button>
    </div>
  );
}

export { keyOf as voiceKey };
