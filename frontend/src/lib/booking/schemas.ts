// Runtime validation for the booking API (contract: specs/003-catalog-api/contracts/openapi.yaml, v1.1.0).
// One schema per component schema; z.infer must equal the generated type (tests/unit/api-contract.test.ts).
// Unknown keys are stripped, so additive API changes are safe; a missing or mistyped field fails the response.
import { z } from "zod";

const Instant = z.iso.datetime();
const LocalDate = z.iso.date();
const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const SlotSchema = z.object({
  startsAt: Instant,
  endsAt: Instant,
  localTime: LocalTime,
});

export const AlternativeSlotSchema = z.object({
  startsAt: Instant,
  endsAt: Instant,
  localDate: LocalDate,
  localTime: z.string(),
});

export const SlotDaySchema = z.object({
  date: LocalDate,
  weekday: Weekday,
  status: z.enum(["available", "fully_booked", "doctor_unavailable", "clinic_closed", "not_working", "no_longer_available"]),
  holidayName: z.string().optional(),
  slots: z.array(SlotSchema),
});

export const DoctorSlotsSchema = z.object({
  doctorSlug: z.string(),
  timeZone: z.string(),
  windowDays: z.number().int(),
  generatedAt: Instant,
  days: z.array(SlotDaySchema),
});

export const AppointmentViewSchema = z.object({
  reference: z.string(),
  status: z.enum(["confirmed", "cancelled", "completed"]),
  doctor: z.object({ slug: z.string(), fullName: z.string(), specialty: z.string() }),
  department: z.object({ slug: z.string(), name: z.string() }),
  startsAt: Instant,
  endsAt: Instant,
  localDate: LocalDate,
  localTime: LocalTime,
  timeZone: z.string(),
  feePkr: z.number().int(),
  patientNameMasked: z.string(),
  mobileMasked: z.string(),
  isSample: z.boolean(),
});

export const ErrorInfoSchema = z.object({
  code: z.enum([
    "not_found",
    "method_not_allowed",
    "validation_error",
    "rate_limited",
    "internal_error",
    "service_unavailable",
    "not_configured",
    "forbidden",
    "request_rejected",
    "slot_taken",
    "slot_unavailable",
    "booking_limit_reached",
    "idempotency_key_reused",
  ]),
  message: z.string(),
  requestId: z.string(),
  details: z.array(z.object({ field: z.string(), issue: z.string() })).optional(),
});

export const BookingConflictSchema = z.object({
  error: ErrorInfoSchema,
  alternatives: z.array(AlternativeSlotSchema).max(5).optional(),
});

export type Slot = z.infer<typeof SlotSchema>;
export type AlternativeSlot = z.infer<typeof AlternativeSlotSchema>;
export type SlotDay = z.infer<typeof SlotDaySchema>;
export type DoctorSlots = z.infer<typeof DoctorSlotsSchema>;
export type AppointmentView = z.infer<typeof AppointmentViewSchema>;
export type ErrorInfo = z.infer<typeof ErrorInfoSchema>;
export type BookingConflict = z.infer<typeof BookingConflictSchema>;
