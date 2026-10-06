"use client";

import { useRouter } from "next/navigation";

import { SignInForm } from "./SignInForm";

/** The sign-in form of the login page: on success go to `next`, or to the password page when it is forced. */
export function LoginPanel({ next }: { next: string }) {
  const router = useRouter();
  return (
    <SignInForm
      autoFocus
      onSignedIn={(viewer) => {
        router.replace(viewer.mustChangePassword ? "/admin/account/password" : next);
      }}
    />
  );
}
