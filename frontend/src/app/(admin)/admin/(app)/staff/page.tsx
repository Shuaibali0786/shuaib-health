import type { Metadata } from "next";

import { StaffListSchema } from "@/admin/lib/schemas";
import { adminGet, getViewer } from "@/admin/lib/server";
import { StaffScreen } from "@/admin/staff/StaffScreen";
import { EmptyState, ErrorState } from "@/admin/ui/States";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

function Refusal() {
  return (
    <div className="card">
      <EmptyState title="You do not have access to this page">Staff accounts are managed by an administrator.</EmptyState>
    </div>
  );
}

export default async function StaffPage() {
  const result = await getViewer();
  if (result.kind !== "ok") return null;
  const { viewer } = result;
  // The backend refuses non-admins too; checking here only avoids a request that cannot succeed.
  if (viewer.kind !== "demo" && viewer.role !== "admin") return <Refusal />;

  const response = await adminGet("staff").catch(() => null);
  if (response?.status === 403) return <Refusal />;
  const parsed = response?.status === 200 ? StaffListSchema.safeParse(response.body) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <div className="sub">Who can sign in, and what they can do.</div>
        </div>
      </div>
      {parsed?.success ? (
        <StaffScreen initial={parsed.data} readOnly={viewer.kind === "demo"} />
      ) : (
        <ErrorState title="We could not load the staff list">Please reload the page in a moment.</ErrorState>
      )}
    </>
  );
}
