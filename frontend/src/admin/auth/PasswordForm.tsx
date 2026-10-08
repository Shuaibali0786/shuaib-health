"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { adminRequest, setCsrfToken } from "@/admin/lib/client";
import { ViewerSchema } from "@/admin/lib/schemas";
import { useHydrated } from "@/admin/ui/useHydrated";

import { passwordMessage } from "./copy";

const MIN = 12;

/** Current password, new password and a repeat. The server enforces the policy; this only saves a round trip. */
export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const ids = { current: useId(), next: useId(), repeat: useId(), error: useId() };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (next.length < MIN) return setError("Use at least 12 characters.");
    if (next !== repeat) return setError("The two new passwords do not match.");
    setPending(true);
    setError(null);
    try {
      const viewer = await adminRequest({ method: "POST", path: "password", body: { currentPassword: current, newPassword: next } }, ViewerSchema);
      setCsrfToken(viewer.csrfToken);
      router.replace("/admin");
    } catch (caught) {
      setError(passwordMessage(caught));
      setPending(false);
    }
  }

  return (
    <form className="form" style={{ maxWidth: 420 }} onSubmit={submit} aria-describedby={error ? ids.error : undefined}>
      {forced ? <p className="notice-line">Your administrator gave you a temporary password. Replace it with your own.</p> : null}
      <div className="field">
        <label htmlFor={ids.current}>{forced ? "Temporary password" : "Current password"}</label>
        <input id={ids.current} type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={ids.next}>New password</label>
        <input id={ids.next} type="password" autoComplete="new-password" required minLength={MIN} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
        <span className="hint">At least 12 characters. Avoid common passwords and your email name.</span>
      </div>
      <div className="field">
        <label htmlFor={ids.repeat}>Repeat new password</label>
        <input id={ids.repeat} type="password" autoComplete="new-password" required maxLength={128} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </div>
      {error ? (
        <p id={ids.error} role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || !hydrated}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </div>
    </form>
  );
}
