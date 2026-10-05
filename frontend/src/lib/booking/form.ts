// Namespace import keeps zod tree-shakable in the browser bundle (see schemas.ts).
import * as z from "zod";

import { normalizePkMobile } from "./phone";

// The visitor's details. The server repeats every rule; these messages are for the form.

export const RULES_MESSAGE = "Please accept the clinic rules to continue.";
export const REASON_MAX = 300;

const NAME_CHARS = /^[\p{L}\p{M} .'’-]+$/u;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const NAME_MESSAGE = "Please enter your full name, using letters only (2 to 80 characters).";

export const DetailsFormSchema = z.object({
  fullName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .refine((value) => value.length >= 2 && value.length <= 80 && NAME_CHARS.test(value), NAME_MESSAGE),
  mobile: z.string().refine((value) => normalizePkMobile(value) !== null, "Please enter a Pakistani mobile number, for example 0300 1234567."),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || (value.length <= 254 && EMAIL.test(value)), "Please enter a valid email address, or leave it empty."),
  reason: z.string().max(REASON_MAX, `Please keep this under ${REASON_MAX} characters.`),
  acceptRules: z.literal(true, RULES_MESSAGE),
  // The honeypot. A person never sees it; the server refuses a booking where it is filled.
  trap: z.string().optional(),
});

export type DetailsFormInput = z.input<typeof DetailsFormSchema>;
export type DetailsFormValues = z.output<typeof DetailsFormSchema>;
