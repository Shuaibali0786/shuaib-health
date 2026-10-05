// The WhatsApp message for the confirmation slip, built from the masked AppointmentView only (FR-051).
// Kept apart from slip.ts so the confirmation page can render this link without loading the PDF,
// QR and calendar code, which ConfirmationActions only imports when the visitor clicks.
import { formatLocalDate, zoneLabel } from "./labels";
import type { AppointmentView } from "./schemas";
import type { SlipClinic } from "./slip";

export function whatsappText(view: AppointmentView, clinic: SlipClinic): string {
  const lines = [
    `Appointment booked${clinic.name ? ` at ${clinic.name}` : ""}`,
    `Reference: ${view.reference}`,
    `Doctor: ${view.doctor.fullName}`,
    `Date: ${formatLocalDate(view.localDate)}`,
    `Time: ${view.localTime} (${zoneLabel(view.timeZone)})`,
  ];
  if (clinic.phoneDisplay !== "") lines.push(`Clinic phone: ${clinic.phoneDisplay}`);
  return lines.join("\n");
}

export function whatsappLink(view: AppointmentView, clinic: SlipClinic): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappText(view, clinic))}`;
}
