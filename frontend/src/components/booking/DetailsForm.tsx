"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { DEMO_DETAILS_NOTICE } from "@/lib/booking/labels";
import { REASON_MAX, type DetailsFormInput, type DetailsFormValues } from "@/lib/booking/form";
import { cn } from "@/lib/cn";

export type DetailsFormApi = UseFormReturn<DetailsFormInput, unknown, DetailsFormValues>;

const FIELD_CLASS = "min-h-11 w-full rounded-control border bg-white px-3 py-2 text-base text-ink placeholder:text-muted";
const FIELD_ORDER = ["fullName", "mobile", "email", "reason", "acceptRules"] as const;
type FieldName = (typeof FIELD_ORDER)[number];

interface FieldProps {
  id: FieldName;
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; className: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        className: cn(FIELD_CLASS, error ? "border-2 border-danger-700" : "border-border-strong"),
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface DetailsFormProps {
  form: DetailsFormApi;
  onSubmit: (values: DetailsFormValues) => void;
  submitting: boolean;
  /** Anything that went wrong with the booking itself (not a field), shown above the button. */
  failure?: ReactNode;
}

/**
 * The visitor's details and the final Confirm button. Nothing here goes into the URL or browser
 * storage: the values live in the form state only. The demo notice sits above the fields and is
 * referenced by the form, so a screen reader hears it first.
 */
export function DetailsForm({ form, onSubmit, submitting, failure }: DetailsFormProps) {
  const {
    register,
    handleSubmit,
    setFocus,
    watch,
    formState: { errors, submitCount },
  } = form;
  const summaryRef = useRef<HTMLDivElement>(null);

  const problems = FIELD_ORDER.flatMap((field) => {
    const message = errors[field]?.message;
    return message ? [{ field, message }] : [];
  });

  // After each failed submit the summary takes focus, once. Typing afterwards does not pull focus back.
  const handledSubmits = useRef(0);
  // A server-side problem moves focus to its field instead (BookingFlow), so only the form's own checks count here.
  const hasClientProblem = FIELD_ORDER.some((field) => Boolean(errors[field]?.message) && errors[field]?.type !== "server");
  useEffect(() => {
    if (submitCount > handledSubmits.current && hasClientProblem) summaryRef.current?.focus();
    handledSubmits.current = submitCount;
  }, [submitCount, hasClientProblem]);

  const reasonLength = (watch("reason") ?? "").length;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p id="booking-demo-notice" className="rounded-control border border-teal-700 bg-teal-50 px-4 py-3 text-base font-semibold text-navy-900">
        {DEMO_DETAILS_NOTICE}
      </p>
      <form noValidate aria-describedby="booking-demo-notice" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {problems.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="booking-errors-title" className="rounded-card border-2 border-danger-700 bg-danger-50 p-4">
            <h3 id="booking-errors-title" className="text-base font-bold text-danger-700">
              {problems.length === 1 ? "There is 1 problem with your details" : `There are ${problems.length} problems with your details`}
            </h3>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-base">
              {problems.map(({ field, message }) => (
                <li key={field}>
                  <a
                    href={`#${field}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setFocus(field);
                    }}
                    className="font-semibold text-danger-700 underline underline-offset-2"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Field id="fullName" label="Full name" error={errors.fullName?.message}>
          {(props) => <input {...props} type="text" autoComplete="name" {...register("fullName")} />}
        </Field>
        <Field id="mobile" label="Mobile number" hint="For example 0300 1234567" error={errors.mobile?.message}>
          {(props) => <input {...props} type="tel" inputMode="tel" autoComplete="tel" {...register("mobile")} />}
        </Field>
        <Field id="email" label="Email (optional)" error={errors.email?.message}>
          {(props) => <input {...props} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field id="reason" label="Reason for visit (optional)" error={errors.reason?.message}>
          {(props) => <textarea {...props} rows={3} {...register("reason")} />}
        </Field>
        <p className="-mt-3 text-right text-sm text-muted" aria-hidden="true">
          {reasonLength}/{REASON_MAX}
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <input
              id="acceptRules"
              type="checkbox"
              aria-invalid={Boolean(errors.acceptRules)}
              aria-describedby={errors.acceptRules ? "acceptRules-error" : undefined}
              className="mt-1 size-6 shrink-0"
              {...register("acceptRules")}
            />
            <label htmlFor="acceptRules" className="text-base text-ink">
              I accept the{" "}
              <a href="#clinic-rules" className="font-semibold text-teal-700 underline underline-offset-2">
                clinic rules
              </a>
            </label>
          </div>
          {errors.acceptRules ? (
            <p id="acceptRules-error" className="text-sm font-semibold text-danger-700">
              {errors.acceptRules.message}
            </p>
          ) : null}
        </div>

        {/* The honeypot: invisible to people and to assistive technology, filled in by bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this field empty
            <input type="text" tabIndex={-1} autoComplete="off" {...register("trap")} name="website" />
          </label>
        </div>

        {failure}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-navy-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
              />
              Booking…
            </>
          ) : (
            "Confirm booking"
          )}
        </button>
      </form>
    </div>
  );
}
