"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as z from "zod";

import { adminRequest, setCsrfToken } from "@/admin/lib/client";

/** Ends the session on the server (the cookie is cleared whatever the answer) and returns to sign-in. */
export function SignOutButton({ className = "btn btn-quiet btn-sm" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await adminRequest({ method: "DELETE", path: "session" }, z.null());
    } catch {
      // The route clears the cookie even when the backend is unreachable; there is nothing to show.
    }
    setCsrfToken(null);
    router.replace("/admin/login");
  }
  return (
    <button type="button" className={className} onClick={signOut} disabled={pending}>
      <LogOut className="i i-sm" aria-hidden="true" />
      Sign out
    </button>
  );
}
