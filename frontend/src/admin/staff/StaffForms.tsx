"use client";

import { useId, useState, type FormEvent } from "react";

import type { Role } from "@/admin/lib/schemas";
import { generateTempPassword } from "@/admin/lib/tempPassword";
import { AlertDialog, Dialog } from "@/admin/ui/Dialog";

export type NewStaff = { email: string; displayName: string; role: Role; temporaryPassword: string };

/** Name, email and role. The temporary password is generated here and shown once after creating. */
export function CreateStaffForm({ onCreate, pending }: { onCreate: (member: NewStaff) => Promise<boolean>; pending: boolean }) {
  const ids = { name: useId(), email: useId(), role: useId() };
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("receptionist");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const created = await onCreate({ email, displayName, role, temporaryPassword: generateTempPassword() });
    if (created) {
      setDisplayName("");
      setEmail("");
      setRole("receptionist");
    }
  }

  return (
    <form className="form" onSubmit={submit} aria-label="Add a staff member">
      <div className="form-row">
        <div className="field">
          <label htmlFor={ids.name}>Name</label>
          <input id={ids.name} required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={ids.email}>Email</label>
          <input id={ids.email} type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={ids.role}>Role</label>
          <select id={ids.role} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="receptionist">Receptionist</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Add staff member
          </button>
        </div>
      </div>
    </form>
  );
}

/** Shows a temporary password exactly once: it is not stored anywhere that can be read back. */
export function TempPasswordDialog({ open, name, password, heading, onClose }: { open: boolean; name: string; password: string; heading: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false); // The password is selectable text, so copying by hand still works.
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={heading}
      actions={
        <>
          <button type="button" className="btn" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <span className="dialog-lead">Give this temporary password to {name}. It is shown only once; they must choose their own at first sign-in.</span>
      <code className="temp-password" data-testid="temp-password">
        {password}
      </code>
    </Dialog>
  );
}

type ConfirmProps = { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void };

export function ConfirmDialog({ open, title, body, confirmLabel, danger = false, onConfirm, onCancel }: ConfirmProps) {
  return (
    <AlertDialog
      open={open}
      onClose={onCancel}
      title={title}
      actions={
        <>
          <button type="button" className="btn" data-initial-focus onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {body}
    </AlertDialog>
  );
}
