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
  /** Demo only: the instant the demo treats as now, and whether it shows the sample day (outside clinic hours). */
  demoNow: z.iso.datetime({ offset: true }).optional(),
  typicalDay: z.boolean().optional(),
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
  jobTitle: z.string().optional(),
  role: RoleSchema,
  isActive: z.boolean(),
  mustChangePassword: z.boolean().optional(),
  lastSignInAt: z.iso.datetime({ offset: true }).nullable().optional(),
  isSample: z.boolean().optional(),
});
export const StaffListSchema = z.array(StaffSchema);

export type SessionIssued = z.infer<typeof SessionIssuedSchema>;
export type Staff = z.infer<typeof StaffSchema>;

// ----- Bookings (US4) -----------------------------------------------------------------------

export const DoctorRefSchema = z.object({ id: z.uuid(), name: z.string(), departmentName: z.string(), isActive: z.boolean().optional() });
export const DepartmentRefSchema = z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean().optional() });
export const LookupsSchema = z.object({ doctors: z.array(DoctorRefSchema), departments: z.array(DepartmentRefSchema) });

export const BookingSummarySchema = z.object({
  reference: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  localDate: z.iso.date(),
  localTime: z.string(),
  status: BookingStatusSchema,
  version: z.number().int(),
  patientNameMasked: z.string(),
  phoneMasked: z.string(),
  doctor: DoctorRefSchema,
  allowedNext: z.array(BookingStatusSchema),
  isSample: z.boolean().optional(),
});

export const HistoryItemSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  fromStatus: BookingStatusSchema.nullable().optional(),
  toStatus: BookingStatusSchema,
  actor: z.string(),
  isUndo: z.boolean(),
});

export const BookingDetailSchema = BookingSummarySchema.extend({
  patientName: z.string(),
  emailMasked: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  patientAge: z.number().int().optional(),
  bookedBy: z.string().optional(),
  feePkr: z.number().int(),
  bookedAt: z.iso.datetime({ offset: true }),
  history: z.array(HistoryItemSchema),
});

export const BookingPageSchema = z.object({
  items: z.array(BookingSummarySchema),
  total: z.number().int(),
  statusCounts: z.partialRecord(BookingStatusSchema, z.number().int()).optional(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const StatusChangeResultSchema = z.object({ booking: BookingDetailSchema, changeId: z.uuid(), undoExpiresAt: z.iso.datetime({ offset: true }) });
export const PhoneRevealSchema = z.object({ phone: z.string(), telHref: z.string(), maskAfterSeconds: z.number().int() });

export type DoctorRef = z.infer<typeof DoctorRefSchema>;
export type Lookups = z.infer<typeof LookupsSchema>;
export type BookingSummary = z.infer<typeof BookingSummarySchema>;
export type BookingDetail = z.infer<typeof BookingDetailSchema>;
export type BookingPage = z.infer<typeof BookingPageSchema>;
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export type StatusChangeResult = z.infer<typeof StatusChangeResultSchema>;
export type PhoneReveal = z.infer<typeof PhoneRevealSchema>;

// ----- Overview (US3) -----------------------------------------------------------------------

/** A KPI against the same weekday a week earlier. Null means "not known" (utilisation with no slots). */
export const TrendSchema = z.object({ value: z.number().int().nullable(), previous: z.number().int().nullable(), delta: z.number().int().nullable(), comparedTo: z.iso.date() });

export const KpisSchema = z.object({
  appointments: TrendSchema,
  arrived: TrendSchema,
  completed: TrendSchema,
  noShows: TrendSchema,
  cancellations: TrendSchema,
  utilisationPct: TrendSchema,
});

export const WorkHoursSchema = z.object({ start: z.string(), end: z.string() });
export const AgendaDoctorSchema = z.object({ doctor: DoctorRefSchema, sessions: z.array(WorkHoursSchema), items: z.array(BookingSummarySchema) });
export const RecentBookingSchema = BookingSummarySchema.extend({ bookedAt: z.iso.datetime({ offset: true }) });

export const OverviewSchema = z.object({
  localDate: z.iso.date(),
  now: z.iso.datetime({ offset: true }),
  clinicClosed: z.string().nullable().optional(),
  kpis: KpisSchema,
  agenda: z.array(AgendaDoctorSchema),
  nextUp: z.array(BookingSummarySchema).max(5),
  recentBookings: z.array(RecentBookingSchema).max(5).optional(),
  isSample: z.boolean(),
});

export type Trend = z.infer<typeof TrendSchema>;
export type Kpis = z.infer<typeof KpisSchema>;
export type AgendaDoctor = z.infer<typeof AgendaDoctorSchema>;
export type RecentBooking = z.infer<typeof RecentBookingSchema>;
export type Overview = z.infer<typeof OverviewSchema>;
