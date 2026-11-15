"use client";

import { useId, useState, type FormEvent } from "react";

import { normalizePkMobile } from "@/lib/booking/phone";
import type { VoiceLang } from "@/voice/types";

type Props = {
  lang: VoiceLang;
  disabled?: boolean;
  /** Sends the typed number as the patient's answer (the same turn as saying it). */
  onSave: (digits: string) => void;
};

/**
 * Feature 013 (owner test 2026-11-09): when the assistant asks for the mobile number, the patient can also type it.
 * A numeric keypad on phones; the website's own mobile rule is checked before anything is sent.
 */
export function PhoneField({ lang, disabled = false, onSave }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const roman = lang === "roman";

  function submit(event: FormEvent) {
    event.preventDefault();
    const e164 = normalizePkMobile(value);
    if (!e164) {
      setError(true);
      return;
    }
    setError(false);
    onSave(`0${e164.slice(3)}`);
  }

  return (
    <form onSubmit={submit} data-testid="phone-field" className="rounded-card border border-border bg-surface p-3">
      <label htmlFor={`${id}-tel`} className="block text-sm font-semibold text-navy-900">
        {roman ? "Mobile number likhein" : "Type your mobile number"}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={`${id}-tel`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="03XX XXXXXXX"
          maxLength={16}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^\d +\-]/g, ""));
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? `${id}-err` : undefined}
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border-strong bg-white px-3 text-base text-ink"
        />
        <button type="submit" disabled={disabled || !value.trim()} className="min-h-11 shrink-0 rounded-control bg-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
          Save number
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-semibold text-danger-700">
          {roman ? "Mobile number 03 se shuru hota hai aur 11 digits ka hota hai." : "A mobile number starts with 03 and has 11 digits."}
        </p>
      ) : null}
    </form>
  );
}
