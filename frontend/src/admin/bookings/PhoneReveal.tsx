"use client";

import { Eye, EyeOff, Phone } from "lucide-react";
import { useEffect, useState } from "react";

import { adminRequest } from "@/admin/lib/client";
import { PhoneRevealSchema, type PhoneReveal as Revealed } from "@/admin/lib/schemas";

export const MASK_AFTER_MS = 60_000;

/**
 * The masked phone with a Reveal button (FR-027). A reveal is a POST the server records in Activity (the
 * demo gets a sample number and records nothing). The full number is shown for 60 seconds, or until the
 * drawer closes (this component unmounts: render it with `key={reference}`), whichever is first; while it
 * is shown there is a Call link.
 */
export function PhoneReveal({ reference, masked, disabled = false }: { reference: string; masked: string; disabled?: boolean }) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(null), MASK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  async function reveal() {
    setBusy(true);
    setFailed(false);
    try {
      setRevealed(await adminRequest({ method: "POST", path: `bookings/${reference}/reveal-phone` }, PhoneRevealSchema));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="reveal">
      <span className="num" data-testid="phone" data-revealed={revealed ? "true" : "false"}>
        {revealed ? revealed.phone : masked}
      </span>
      {revealed ? (
        <>
          <a className="btn btn-sm" href={revealed.telHref}>
            <Phone className="i i-sm" aria-hidden="true" />
            Call
          </a>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setRevealed(null)}>
            <EyeOff className="i i-sm" aria-hidden="true" />
            Hide
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-sm" onClick={() => void reveal()} disabled={busy || disabled}>
          <Eye className="i i-sm" aria-hidden="true" />
          Reveal
        </button>
      )}
      {failed ? (
        <span role="alert" className="field-error">
          Could not reveal the number. Please try again.
        </span>
      ) : null}
    </span>
  );
}
