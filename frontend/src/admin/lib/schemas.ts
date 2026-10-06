// Runtime validation for the Command Centre API (contract: specs/003-catalog-api/contracts/openapi.yaml,
// v1.2.0, tag `command-centre`). z.infer must equal the generated type (tests/unit/admin-schemas.test.ts).
// Each story adds the schemas of its own screens here. Unknown keys are stripped, so additive API
// changes are safe; a missing or mistyped field fails the response.
// A namespace import, not `import { z }`, to keep the locale files out of the bundle.
import * as z from "zod";

export { ErrorInfoSchema, ErrorResponseSchema } from "@/lib/booking/schemas";
export type { ErrorInfo, ErrorResponse } from "@/lib/booking/schemas";

export const RoleSchema = z.enum(["admin", "receptionist"]);

export const BookingStatusSchema = z.enum(["confirmed", "arrived", "completed", "no_show", "cancelled"]);

export const ViewerSchema = z.object({
  kind: z.enum(["staff", "demo"]),
  role: RoleSchema.optional(),
  displayName: z.string().optional(),
  mustChangePassword: z.boolean().optional(),
  csrfToken: z.string(),
  clinicToday: z.iso.date(),
  timezone: z.string(),
  sessionExpiresAt: z.iso.datetime().optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export type Viewer = z.infer<typeof ViewerSchema>;

/** What the backend returns to this server on sign-in and password change. The token never leaves the server. */
export const SessionIssuedSchema = z.object({ token: z.string().min(1), viewer: ViewerSchema });

export const StaffSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  isActive: z.boolean(),
  mustChangePassword: z.boolean().optional(),
  lastSignInAt: z.iso.datetime({ offset: true }).nullable().optional(),
  isSample: z.boolean().optional(),
});
export const StaffListSchema = z.array(StaffSchema);

export type SessionIssued = z.infer<typeof SessionIssuedSchema>;
export type Staff = z.infer<typeof StaffSchema>;
