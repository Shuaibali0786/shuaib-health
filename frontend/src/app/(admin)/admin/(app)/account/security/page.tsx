import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TwoFactorCard } from "@/admin/account/TwoFactorCard";
import { TwoFactorStatusSchema, type TwoFactorStatus } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";

export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

/** Account security (Feature 011): two-step sign-in, next to the password change. Staff only. */
export default async function SecurityPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  if (viewer.kind === "demo") redirect("/admin");
  if (viewer.mustChangePassword) redirect("/admin/account/password");
  let initial: TwoFactorStatus | null = null;
  try {
    const result = await adminGet("two-factor");
    const parsed = TwoFactorStatusSchema.safeParse(result.body);
    if (result.status === 200 && parsed.success) initial = parsed.data;
  } catch {
    // The card says the settings could not be loaded; the rest of the page still works.
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Security</h1>
          <div className="sub">Protect your Command Centre account.</div>
        </div>
      </div>
      <div className="stack">
        <TwoFactorCard initial={initial} />
        <p className="notice-line">
          <Link href="/admin/account/password" prefetch={false}>
            Change your password
          </Link>
        </p>
      </div>
    </>
  );
}
