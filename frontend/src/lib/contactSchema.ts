import { z } from "zod";

/**
 * Validation for the Contact form (FR-073). The demo never sends the message; the same schema is
 * meant to validate the real endpoint later (constitution IV). Messages are plain and specific.
 */

export const CONTACT_LIMITS = {
  name: { min: 2, max: 80 },
  subject: { min: 3, max: 100 },
  message: { min: 10, max: 1000 },
} as const;

/** Removes spaces, dashes, dots and brackets, so "0300-000 0000" and "(021) 3000 0000" can be compared. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-.()]/g, "");
}

/** A phone number is an optional "+" followed by 10 to 13 digits, once separators are removed. */
export function isValidPhone(value: string): boolean {
  return /^\+?\d{10,13}$/.test(normalizePhone(value));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A simple shape check: something@something.tld, no spaces. Enough to catch typos. */
export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function isValidContact(value: string): boolean {
  return isValidPhone(value) || isValidEmail(value);
}

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .min(CONTACT_LIMITS.name.min, `Your name must be at least ${CONTACT_LIMITS.name.min} characters.`)
    .max(CONTACT_LIMITS.name.max, `Your name must be ${CONTACT_LIMITS.name.max} characters or fewer.`),
  contact: z
    .string()
    .trim()
    .min(1, "Enter a phone number or an email address.")
    .refine(isValidContact, "Enter a valid phone number, such as 0300-0000000, or a valid email address."),
  subject: z
    .string()
    .trim()
    .min(1, "Enter a subject.")
    .min(CONTACT_LIMITS.subject.min, `The subject must be at least ${CONTACT_LIMITS.subject.min} characters.`)
    .max(CONTACT_LIMITS.subject.max, `The subject must be ${CONTACT_LIMITS.subject.max} characters or fewer.`),
  message: z
    .string()
    .trim()
    .min(1, "Enter your message.")
    .min(CONTACT_LIMITS.message.min, `Your message must be at least ${CONTACT_LIMITS.message.min} characters.`)
    .max(CONTACT_LIMITS.message.max, `Your message must be ${CONTACT_LIMITS.message.max.toLocaleString("en-US")} characters or fewer.`),
});

export type ContactValues = z.infer<typeof contactSchema>;
