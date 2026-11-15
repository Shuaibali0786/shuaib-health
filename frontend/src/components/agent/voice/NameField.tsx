"use client";

import { useId, useState, type FormEvent } from "react";

import type { VoiceLang } from "@/voice/types";

type Props = {
  lang: VoiceLang;
  disabled?: boolean;
  /** Sends the typed name as the patient's answer (the same turn as saying it). */
  onSave: (name: string) => void;
};

// The website form's rule: letters (any language), spaces, dots, apostrophes and hyphens, 2 to 80 characters.
const NAME_SHAPE = /^[\p{L}\p{M} .'’-]{2,80}$/u;

/**
 * Feature 013 (owner B4, 2026-11-09): when the name was not understood once, the patient can type it here. Never a
 * third "please say it again".
 */
export function NameField({ lang, disabled = false, onSave }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const roman = lang === "roman";

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = value.trim().replace(/\s+/g, " ");
    if (!NAME_SHAPE.test(name) || !/\p{L}{2}/u.test(name)) {
      setError(true);
      return;
    }
    setError(false);
    onSave(name);
  }

  return (
    <form onSubmit={submit} data-testid="name-field" className="rounded-card border border-border bg-surface p-3">
      <label htmlFor={`${id}-name`} className="block text-sm font-semibold text-navy-900">
        {roman ? "Apna poora naam likhein" : "Type your full name"}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? `${id}-err` : undefined}
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-white px-3 text-base text-ink"
        />
        <button type="submit" disabled={disabled || !value.trim()} className="min-h-11 shrink-0 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          Save name
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-semibold text-danger-700">
          {roman ? "Naam mein sirf haroof likhein, kam se kam 2." : "Please use letters only, at least 2."}
        </p>
      ) : null}
    </form>
  );
}
