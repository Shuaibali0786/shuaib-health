"use client";

import { useId } from "react";

import { clinicDate, formatClock, formatDayMonth } from "@/admin/lib/format";
import type { Role, Staff } from "@/admin/lib/schemas";

export type StaffActions = {
  onRole: (member: Staff, role: Role) => void;
  onActive: (member: Staff, active: boolean) => void;
  onReset: (member: Staff) => void;
};

function lastSeen(value: string | null | undefined): string {
  if (!value) return "Never";
  return `${formatDayMonth(clinicDate(value))}, ${formatClock(value)}`;
}

function RoleSelect({ member, onRole, disabled }: { member: Staff; onRole: StaffActions["onRole"]; disabled: boolean }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Role of {member.displayName}
      </label>
      <select id={id} value={member.role} disabled={disabled} onChange={(e) => onRole(member, e.target.value as Role)} style={{ minHeight: 36, borderRadius: 10 }}>
        <option value="admin">Admin</option>
        <option value="receptionist">Receptionist</option>
      </select>
    </>
  );
}

export function StaffTable({ staff, actions, readOnly, busyId }: { staff: Staff[]; actions: StaffActions; readOnly: boolean; busyId: string | null }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Staff accounts</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Last sign-in</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const disabled = readOnly || busyId === member.id;
            return (
              <tr key={member.id} data-staff={member.email}>
                <td className="who-cell">
                  <b>{member.displayName}</b>
                  <span>{member.email}</span>
                </td>
                <td>{readOnly ? (member.role === "admin" ? "Admin" : "Receptionist") : <RoleSelect member={member} onRole={actions.onRole} disabled={disabled} />}</td>
                <td>
                  <span className={`pill ${member.isActive ? "pill-ok" : "pill-off"}`}>{member.isActive ? "Active" : "Inactive"}</span>
                  {member.mustChangePassword ? (
                    <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 4 }}>
                      Must change password
                    </span>
                  ) : null}
                </td>
                <td className="num">{lastSeen(member.lastSignInAt)}</td>
                <td>
                  {readOnly ? null : (
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => actions.onReset(member)}>
                        Reset password
                      </button>
                      <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => actions.onActive(member, !member.isActive)}>
                        {member.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
