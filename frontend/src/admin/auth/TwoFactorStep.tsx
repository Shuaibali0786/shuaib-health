"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { adminRequest, setCsrfToken } from "@/admin/lib/client";
import { ViewerSchema, type Viewer } from "@/admin/lib/schemas";
import { useHydrated } from "@/admin/ui/useHydrated";

import { endsTwoFactorStep, twoFactorMessage } from "./copy";

type Props = {
  onSignedIn: (viewer: Viewer) => void;
  /** Back to the email and password, with a message (the step expired or the account was locked). */
  onRestart: (message: string | null) => void;
  formId?: string;
  hideSubmit?: boolean;
  onPendingChange?: (pending: boolean) => void;
};

/**
 * The second sign-in step (Feature 011): the 6-digit code from the authenticator app, or a backup code.
 * The challenge itself lives in an httpOnly cookie, so this form sends only what the person types.
 */
export function TwoFactorStep({ onSignedIn, onRestart, formId, hideSubmit = false, onPendingChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    input.current?.focus();
  }, [useBackup]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    setError(null);
    const typed = value.trim();
    try {
      const viewer = await adminRequest(
        { method: "POST", path: "session/two-factor", body: useBackup ? { backupCode: typed } : { code: typed.replace(/\s/g, "") } },
        ViewerSchema,
      );
      setCsrfToken(viewer.csrfToken);
      onSignedIn(viewer);
    } catch (caught) {
      setValue("");
      if (endsTwoFactorStep(caught)) onRestart(twoFactorMessage(caught));
      else setError(twoFactorMessage(caught));
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <form id={formId} className="form" onSubmit={submit} aria-describedby={error ? `${hintId} ${errorId}` : hintId}>
      <div className="field">
        <label htmlFor={inputId}>{useBackup ? "Backup code" : "Code from your authenticator app"}</label>
        <input
          ref={input}
          id={inputId}
          name={useBackup ? "backupCode" : "code"}
          type="text"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize={useBackup ? "characters" : "off"}
          spellCheck={false}
          pattern={useBackup ? "[A-Za-z0-9 -]{10,13}" : "[0-9 ]{6,7}"}
          maxLength={useBackup ? 13 : 7}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
        />
        <p id={hintId} className="hint">
          {useBackup ? "Each backup code works once, for example ABCDE-FGHJK." : "Open your authenticator app and type the 6-digit code for this clinic."}
        </p>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      {hideSubmit ? null : (
        <button type="submit" className="btn btn-primary btn-block" disabled={pending || !hydrated}>
          {pending ? "Checking…" : "Verify and sign in"}
        </button>
      )}
      <div className="two-factor-links">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            setUseBackup((on) => !on);
            setValue("");
            setError(null);
          }}
        >
          {useBackup ? "Use the app code instead" : "Use a backup code instead"}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => onRestart(null)}>
          Start again
        </button>
      </div>
    </form>
  );
}
