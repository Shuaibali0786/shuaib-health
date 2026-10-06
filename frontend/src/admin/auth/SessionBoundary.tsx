"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { onSessionEnded, setCsrfToken } from "@/admin/lib/client";
import type { Viewer } from "@/admin/lib/schemas";
import { Dialog } from "@/admin/ui/Dialog";

import { SignInForm } from "./SignInForm";

const FORM_ID = "session-expired-form";

/**
 * Lives inside the signed-in shell. It hands the session's CSRF token to the browser client, and when
 * any request finds the session over it opens a sign-in dialog on top of the current screen: after
 * signing in the data is refreshed in place and the person is exactly where they were.
 */
export function SessionBoundary({ viewer }: { viewer: Pick<Viewer, "csrfToken"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCsrfToken(viewer.csrfToken);
  }, [viewer.csrfToken]);

  useEffect(() => onSessionEnded(() => setOpen(true)), []);

  return (
    <Dialog
      open={open}
      onClose={() => {}}
      title="Your session has ended"
      actions={
        <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      }
    >
      <span className="dialog-lead">Sign in again to carry on where you were.</span>
      <SignInForm
        formId={FORM_ID}
        hideSubmit
        autoFocus
        onPendingChange={setPending}
        onSignedIn={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </Dialog>
  );
}
