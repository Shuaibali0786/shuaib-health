"use client";

import { useId, useState, type FormEvent } from "react";

import type { VoiceLang } from "@/voice/types";

type Props = {
  lang: VoiceLang;
  disabled?: boolean;
  /** Sends the typed email as the patient's answer (the same turn as saying it). */
  onSave: (email: string) => void;
  /** "Skip" is still an answer: the email is optional. */
  onSkip: () => void;
};

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/**
 * Feature 013 (owner 2026-11-09): when a spoken email was not understood once (or was wrong), the patient can type it
 * here. The same email shape as the website form is checked before anything is sent.
 */
export function EmailField({ lang, disabled = false, onSave, onSkip }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const roman = lang === "roman";

  function submit(event: FormEvent) {
    event.preventDefault();
    const email = value.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(email) || email.length > 254) {
      setError(true);
      return;
    }
    setError(false);
    onSave(email);
  }

  return (
    <form onSubmit={submit} data-testid="email-field" className="rounded-card border border-border bg-surface p-3">
      <label htmlFor={`${id}-email`} className="block text-sm font-semibold text-navy-900">
        {roman ? "Email likhein (zaroori nahi)" : "Type your email (optional)"}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@gmail.com"
          maxLength={254}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? `${id}-err` : undefined}
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 basis-40 rounded-control border border-border-strong bg-white px-3 text-base text-ink"
        />
        <button type="submit" disabled={disabled || !value.trim()} className="min-h-11 shrink-0 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          Save email
        </button>
        <button type="button" onClick={onSkip} disabled={disabled} className="min-h-11 shrink-0 rounded-control border border-border-strong bg-white px-4 text-sm font-semibold text-navy-900 disabled:opacity-50">
          Skip
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-semibold text-danger-700">
          {roman ? "Email is tarah likhein: naam@gmail.com" : "Please write it like this: name@gmail.com"}
        </p>
      ) : null}
    </form>
  );
}
