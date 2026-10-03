"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CONTACT_LIMITS, contactSchema, type ContactValues } from "@/lib/contactSchema";
import { cn } from "@/lib/cn";

const FIELD_CLASS =
  "min-h-11 w-full rounded-control border bg-white px-3 py-2 text-base text-ink placeholder:text-muted";

const DEFAULTS: ContactValues = { name: "", contact: "", subject: "", message: "" };

/** The order fields appear in, which is also the order of the error summary. */
const FIELD_ORDER: Array<keyof ContactValues> = ["name", "contact", "subject", "message"];

interface FieldProps {
  id: keyof ContactValues;
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
        {label} <span className="font-normal text-muted">(required)</span>
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
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The Contact form. It checks what you type, in the browser, and then stops: nothing is sent,
 * saved or stored (FR-074). There is no fetch() and no browser storage here, on purpose.
 *
 * On a failed submit the error summary takes focus (its links move focus to each field), the
 * entered text is kept, and every problem is also described next to its field.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, submitCount },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: DEFAULTS,
    shouldFocusError: false,
  });

  function onValid() {
    setSent(true);
    reset(DEFAULTS);
  }

  function onInvalid() {
    setSent(false);
  }

  const problems = FIELD_ORDER.flatMap((field) => {
    const message = errors[field]?.message;
    return message ? [{ field, message }] : [];
  });

  // After each failed submit the summary takes focus, once. Typing afterwards does not pull focus back.
  const handledSubmits = useRef(0);
  const hasProblems = problems.length > 0;
  useEffect(() => {
    if (submitCount > handledSubmits.current && hasProblems) summaryRef.current?.focus();
    handledSubmits.current = submitCount;
  }, [submitCount, hasProblems]);

  return (
    <form noValidate onSubmit={handleSubmit(onValid, onInvalid)} className="flex max-w-xl flex-col gap-5">
      {problems.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="contact-errors-title"
          className="rounded-card border-2 border-danger-700 bg-danger-50 p-4"
        >
          <h3 id="contact-errors-title" className="text-base font-bold text-danger-700">
            {problems.length === 1 ? "There is 1 problem with your message" : `There are ${problems.length} problems with your message`}
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

      <Field id="name" label="Your name" error={errors.name?.message}>
        {(props) => <input {...props} type="text" autoComplete="name" {...register("name")} />}
      </Field>
      <Field id="contact" label="Phone or email" hint="We use this only to reply. In this demo nothing is sent." error={errors.contact?.message}>
        {(props) => <input {...props} type="text" inputMode="email" autoComplete="off" {...register("contact")} />}
      </Field>
      <Field id="subject" label="Subject" error={errors.subject?.message}>
        {(props) => <input {...props} type="text" autoComplete="off" {...register("subject")} />}
      </Field>
      <Field
        id="message"
        label="Message"
        hint={`${CONTACT_LIMITS.message.min} to ${CONTACT_LIMITS.message.max.toLocaleString("en-US")} characters.`}
        error={errors.message?.message}
      >
        {(props) => <textarea {...props} rows={6} {...register("message")} />}
      </Field>

      <div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-navy-900 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-navy-800"
        >
          Send message
        </button>
      </div>

      <div role="status" aria-live="polite">
        {sent ? (
          <p className="rounded-card border border-teal-700 bg-teal-50 p-4 text-base font-semibold text-navy-900">
            Messages are not sent in this demo yet. Nothing was saved or transmitted.
          </p>
        ) : null}
      </div>
    </form>
  );
}
