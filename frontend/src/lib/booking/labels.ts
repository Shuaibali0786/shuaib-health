// Display helpers for the booking flow: day status labels, parts of the day and dates.
import type { SlotDay } from "./schemas";

const STATUS_LABELS: Record<SlotDay["status"], string> = {
  available: "Available",
  fully_booked: "Fully booked",
  doctor_unavailable: "Not available",
  clinic_closed: "Clinic closed",
  not_working: "Not available",
  no_longer_available: "No times left today",
};

export function dayStatusLabel(status: SlotDay["status"]): string {
  return STATUS_LABELS[status];
}

export type PartOfDay = "morning" | "afternoon" | "evening";

/** `localTime` is "HH:MM" in the clinic's zone. Morning is before 12:00, afternoon before 17:00. */
export function partOfDay(localTime: string): PartOfDay {
  if (localTime < "12:00") return "morning";
  if (localTime < "17:00") return "afternoon";
  return "evening";
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * "Tue 6 Oct" for a clinic-local `YYYY-MM-DD`. The date is already local to the clinic, so it is
 * placed at noon UTC and formatted in UTC: the visitor's own zone can never shift it a day.
 */
export function formatLocalDate(date: string): string {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const parts = DATE_FORMAT.formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("weekday")} ${pick("day")} ${pick("month")}`;
}

/** The long zone name, for example "Pakistan Standard Time". */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export const STEP_LABEL = {
  department: "Department",
  doctor: "Doctor",
  date: "Date",
  time: "Time",
  details: "Details",
} as const;

export const STEP_HEADING = {
  department: "Choose a department",
  doctor: "Choose a doctor",
  date: "Choose a date",
  time: "Choose a time",
  details: "Your details",
} as const;

export const NO_SLOTS_MESSAGE = "No online slots in the next 14 days — please call the clinic";
export const DOCTOR_GONE_MESSAGE = "This doctor is no longer available for online booking.";
export const DEMO_DETAILS_NOTICE = "Demo site: please don't enter real medical details";
