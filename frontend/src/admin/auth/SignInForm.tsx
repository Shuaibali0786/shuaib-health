"use client";

import { useId, useState, type FormEvent } from "react";

import { adminRequest, setCsrfToken } from "@/admin/lib/client";
import { ViewerSchema, type Viewer } from "@/admin/lib/schemas";
import { useHydrated } from "@/admin/ui/useHydrated";

import { signInMessage } from "./copy";

type Props = {
  onSignedIn: (viewer: Viewer) => void;
  /** Give the form an id and put the submit button elsewhere (a dialog's action row) with `form={id}`. */
  formId?: string;
  hideSubmit?: boolean;
  autoFocus?: boolean;
  onPendingChange?: (pending: boolean) => void;
};

/** Email and password. Failures are generic: the message never says which of the two was wrong. */
export function SignInForm({ onSignedIn, formId, hideSubmit = false, autoFocus = false, onPendingChange }: Props) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    setError(null);
    try {
      const viewer = await adminRequest({ method: "POST", path: "session", body: { email, password } }, ViewerSchema);
      setCsrfToken(viewer.csrfToken);
      setPassword("");
      onSignedIn(viewer);
    } catch (caught) {
      setError(signInMessage(caught));
      setPassword("");
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <form id={formId} className="form" onSubmit={submit} aria-describedby={error ? errorId : undefined}>
      <div className="field">
        <label htmlFor={emailId}>Email</label>
        <input id={emailId} name="email" type="email" autoComplete="username" required maxLength={254} autoFocus={autoFocus} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={passwordId}>Password</label>
        <input id={passwordId} name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      {hideSubmit ? null : (
        <button type="submit" className="btn btn-primary btn-block" disabled={pending || !hydrated}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      )}
    </form>
  );
}
