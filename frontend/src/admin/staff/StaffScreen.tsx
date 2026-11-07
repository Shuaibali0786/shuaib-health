"use client";

import { useState } from "react";
import * as z from "zod";

import { staffMessage } from "@/admin/auth/copy";
import { adminRequest } from "@/admin/lib/client";
import { StaffSchema, type Role, type Staff } from "@/admin/lib/schemas";
import { generateTempPassword } from "@/admin/lib/tempPassword";

import { PermissionsCard } from "./PermissionsCard";
import { ConfirmDialog, CreateStaffForm, TempPasswordDialog, type NewStaff } from "./StaffForms";
import { StaffTable, type StaffActions } from "./StaffTable";

type Shown = { name: string; password: string; heading: string };
type Pending = { kind: "deactivate" | "reset" | "two-factor"; member: Staff };

/** The Staff screen: the list, add, change role, deactivate/reactivate, reset password and (Feature 011) reset two-step sign-in. */
export function StaffScreen({ initial, readOnly }: { initial: Staff[]; readOnly: boolean }) {
  const [staff, setStaff] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);

  const replace = (updated: Staff) => setStaff((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));

  async function run(member: Staff | null, action: () => Promise<void>) {
    setError(null);
    setBusyId(member?.id ?? null);
    try {
      await action();
    } catch (caught) {
      setError(staffMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function create(next: NewStaff): Promise<boolean> {
    let created = false;
    setCreating(true);
    await run(null, async () => {
      const member = await adminRequest({ method: "POST", path: "staff", body: next }, StaffSchema);
      setStaff((rows) => [...rows, member]);
      setShown({ name: member.displayName, password: next.temporaryPassword, heading: "Account created" });
      created = true;
    });
    setCreating(false);
    return created;
  }

  const patch = (member: Staff, body: { role?: Role; isActive?: boolean }) =>
    run(member, async () => replace(await adminRequest({ method: "PATCH", path: `staff/${member.id}`, body }, StaffSchema)));

  const reset = (member: Staff) =>
    run(member, async () => {
      const password = generateTempPassword();
      await adminRequest({ method: "POST", path: `staff/${member.id}/reset-password`, body: { temporaryPassword: password } }, z.null());
      replace({ ...member, mustChangePassword: true });
      setShown({ name: member.displayName, password, heading: "Temporary password set" });
    });

  const resetTwoFactor = (member: Staff) =>
    run(member, async () => {
      await adminRequest({ method: "POST", path: `staff/${member.id}/two-factor/reset` }, z.null());
      replace({ ...member, twoFactorEnabled: false });
    });

  const actions: StaffActions = {
    onRole: (member, role) => void patch(member, { role }),
    onActive: (member, active) => (active ? void patch(member, { isActive: true }) : setConfirm({ kind: "deactivate", member })),
    onReset: (member) => setConfirm({ kind: "reset", member }),
    onResetTwoFactor: (member) => setConfirm({ kind: "two-factor", member }),
  };

  return (
    <div className="stack">
      {readOnly ? <p className="notice-line">This is a sample list. The demo is read-only: changes are not saved.</p> : null}
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      {readOnly ? null : (
        <section className="card" aria-labelledby="add-staff-title">
          <div className="card-head">
            <h2 id="add-staff-title">Add a staff member</h2>
          </div>
          <div className="panel-pad">
            <CreateStaffForm onCreate={create} pending={creating} />
          </div>
        </section>
      )}
      <section className="card" aria-labelledby="staff-list-title">
        <div className="card-head">
          <h2 id="staff-list-title">People with access</h2>
        </div>
        {staff.length === 0 ? <p className="empty">No staff accounts to show.</p> : <StaffTable staff={staff} actions={actions} readOnly={readOnly} busyId={busyId} />}
      </section>
      <PermissionsCard />

      <TempPasswordDialog open={shown !== null} name={shown?.name ?? ""} password={shown?.password ?? ""} heading={shown?.heading ?? ""} onClose={() => setShown(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "reset"
            ? `Reset password for ${confirm.member.displayName}?`
            : confirm?.kind === "two-factor"
              ? `Reset two-step sign-in for ${confirm.member.displayName}?`
              : `Deactivate ${confirm?.member.displayName ?? ""}?`
        }
        body={
          confirm?.kind === "reset"
            ? "They are signed out everywhere and must choose a new password. You will see a temporary password once."
            : confirm?.kind === "two-factor"
              ? "Use this when they lost their phone and backup codes. Their two-step sign-in is turned off, their backup codes stop working and they are signed out. They can turn it on again from their Security page."
              : "They are signed out at once and cannot sign in until you reactivate the account."
        }
        confirmLabel={confirm?.kind === "reset" ? "Reset password" : confirm?.kind === "two-factor" ? "Reset two-step sign-in" : "Deactivate"}
        danger={confirm?.kind !== "reset"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const pending = confirm;
          setConfirm(null);
          if (!pending) return;
          if (pending.kind === "reset") void reset(pending.member);
          else if (pending.kind === "two-factor") void resetTwoFactor(pending.member);
          else void patch(pending.member, { isActive: false });
        }}
      />
    </div>
  );
}
