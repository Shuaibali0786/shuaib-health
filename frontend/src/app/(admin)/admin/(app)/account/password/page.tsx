import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/admin/auth/PasswordForm";
import { getViewer } from "@/admin/lib/server";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  if (viewer.kind === "demo") redirect("/admin");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Change password</h1>
          <div className="sub">{viewer.mustChangePassword ? "Choose a new password to continue." : "Choose a new password for your account."}</div>
        </div>
      </div>
      <div className="card panel-pad">
        <PasswordForm forced={viewer.mustChangePassword === true} />
      </div>
    </>
  );
}
