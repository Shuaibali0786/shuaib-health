"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { animate } from "framer-motion/dom/mini";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { BookingUnavailable } from "@/components/booking/BookingUnavailable";
import { CallClinicNote } from "@/components/booking/CallClinicNote";
import { DateStrip } from "@/components/booking/DateStrip";
import { DepartmentStep } from "@/components/booking/DepartmentStep";
import { DetailsForm } from "@/components/booking/DetailsForm";
import { DoctorStep } from "@/components/booking/DoctorStep";
import { SlotGrid } from "@/components/booking/SlotGrid";
import { SlotTakenNotice } from "@/components/booking/SlotTakenNotice";
import { StepIndicator } from "@/components/booking/StepIndicator";
import { DetailsFormSchema, type DetailsFormInput, type DetailsFormValues } from "@/lib/booking/form";
import { FLOW_STEPS, parseFlowParams, serializeFlowParams, type FlowParams, type FlowStep } from "@/lib/booking/flowUrl";
import { DOCTOR_GONE_MESSAGE, NO_SLOTS_MESSAGE, STEP_HEADING, formatLocalDate, timeZoneLabel } from "@/lib/booking/labels";
import { fetchSlots, postBooking } from "@/lib/booking/client";
import { AppointmentViewSchema, BookingConflictSchema, ErrorResponseSchema, type AlternativeSlot, type DoctorSlots } from "@/lib/booking/schemas";
import { formatPkr } from "@/lib/format";
import { EASE_SOFT, STEP_DURATION, STEP_OFFSET_Y } from "@/lib/motion";
import { ROUTES } from "@/lib/routes";
import type { Department, Doctor, PhoneNumber } from "@/types/content";

interface BookingFlowProps {
  departments: Department[];
  doctors: Doctor[];
  clinicPhone: PhoneNumber;
  /** The clinic's IANA time zone, shown next to times. */
  timeZone: string;
}

type SlotsState =
  | { slug: null; status: "idle"; data: null }
  | { slug: string; status: "loading" | "failed"; data: null }
  | { slug: string; status: "ready"; data: DoctorSlots };

type SlotsAction =
  | { type: "retry"; slug: string }
  | { type: "loaded"; slug: string; data: DoctorSlots }
  | { type: "failed"; slug: string };

function slotsReducer(state: SlotsState, action: SlotsAction): SlotsState {
  switch (action.type) {
    case "retry":
      return { slug: action.slug, status: "loading", data: null };
    case "loaded":
      return { slug: action.slug, status: "ready", data: action.data };
    case "failed":
      return { slug: action.slug, status: "failed", data: null };
  }
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "failed"; reason: "generic" | "slot" }
  | { status: "taken"; key: string; message: string; alternatives: AlternativeSlot[] };

const FIELD_MESSAGES = {
  fullName: "Please enter your full name, using letters only (2 to 80 characters).",
  mobile: "Please enter a Pakistani mobile number, for example 0300 1234567.",
  email: "Please enter a valid email address, or leave it empty.",
  reason: "Please keep this under 300 characters.",
  acceptRules: "Please accept the clinic rules to continue.",
} as const;
type FormField = keyof typeof FIELD_MESSAGES;

const isFormField = (field: string): field is FormField => field in FIELD_MESSAGES;

const BUTTON_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-navy-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60";
const BUTTON_OUTLINE =
  "inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface";

function Skeleton() {
  return (
    <div role="status" aria-label="Loading times" className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-11 w-28 animate-pulse rounded-control bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/**
 * The booking flow: department → doctor → date → time → details, ending with Confirm. Non-personal
 * choices live in the URL (so Back works); name, mobile, email and reason live only in the form.
 * Times come from the server, so nothing here decides what is free.
 */
export function BookingFlow({ departments, doctors, clinicPhone, timeZone }: BookingFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(
    () => parseFlowParams(searchParams, { departments, doctors }),
    [searchParams, departments, doctors],
  );

  const doctor = doctors.find((candidate) => candidate.slug === params.doctor);
  const department = departments.find((candidate) => candidate.slug === params.department);
  const departmentDoctors = useMemo(
    () => (department ? doctors.filter((candidate) => candidate.departmentId === department.id) : []),
    [department, doctors],
  );

  // Slots for the chosen doctor, fetched from our own server (never straight from the API).
  const [slots, dispatchSlots] = useReducer(slotsReducer, { slug: null, status: "idle", data: null });
  const [attempt, setAttempt] = useState(0);
  const doctorSlug = params.doctor;
  useEffect(() => {
    if (!doctorSlug) return;
    const controller = new AbortController();
    (async () => {
      try {
        dispatchSlots({ type: "loaded", slug: doctorSlug, data: await fetchSlots(doctorSlug, controller.signal) });
      } catch {
        if (!controller.signal.aborted) dispatchSlots({ type: "failed", slug: doctorSlug });
      }
    })();
    return () => controller.abort();
  }, [doctorSlug, attempt]);

  const slotData = slots.slug === doctorSlug && slots.status === "ready" ? slots.data : null;
  const slotsFailed = Boolean(doctorSlug) && slots.slug === doctorSlug && slots.status === "failed";
  const slotsLoading = Boolean(doctorSlug) && !slotData && !slotsFailed;
  const retrySlots = () => {
    if (!doctorSlug) return;
    dispatchSlots({ type: "retry", slug: doctorSlug });
    setAttempt((count) => count + 1);
  };

  const day = slotData?.days.find((candidate) => candidate.date === params.date);
  const slot = day?.slots.find((candidate) => candidate.localTime === params.time);
  const zoneName = timeZoneLabel(slotData?.timeZone ?? timeZone);

  // The details live in the form only. Unmounting a step keeps the values, so Back never loses them.
  const form = useForm<DetailsFormInput, unknown, DetailsFormValues>({
    resolver: zodResolver(DetailsFormSchema),
    defaultValues: { fullName: "", mobile: "", email: "", reason: "", trap: "" },
    shouldFocusError: false,
  });
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);

  const go = (next: FlowParams, mode: "push" | "replace" = "push") => {
    router[mode](`${ROUTES.bookAppointment}${serializeFlowParams(next)}`);
  };
  const stepIndex = FLOW_STEPS.indexOf(params.step);
  const flowKey = `${params.date ?? ""}|${params.time ?? ""}|${params.step}`;
  const goBack = () => {
    const previous: FlowStep = FLOW_STEPS[Math.max(0, stepIndex - 1)] ?? "department";
    go({ ...params, step: previous });
  };
  const goNext = () => go({ ...params, step: FLOW_STEPS[Math.min(FLOW_STEPS.length - 1, stepIndex + 1)] ?? "details" });

  // Step changes: move focus to the new heading and play a short, reduced-motion-safe entrance.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    const element = stepRef.current;
    if (!element || typeof element.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reset = () => {
      element.style.opacity = "";
      element.style.transform = "";
    };
    animate(element, { opacity: [0, 1], transform: [`translateY(${STEP_OFFSET_Y}px)`, "translateY(0px)"] }, { duration: STEP_DURATION, ease: EASE_SOFT }).then(reset);
  }, [params.step]);

  async function onSubmit(values: DetailsFormValues) {
    if (!slot || !params.doctor || submit.status === "submitting") return;
    setSubmit({ status: "submitting" });
    let answer;
    try {
      answer = await postBooking(
        {
          doctorSlug: params.doctor,
          startsAt: slot.startsAt,
          fullName: values.fullName,
          mobile: values.mobile,
          email: values.email === "" ? null : values.email,
          reason: values.reason.trim() === "" ? null : values.reason.trim(),
          acceptRules: true,
          trap: values.trap ? values.trap : null,
        },
        crypto.randomUUID(),
      );
    } catch {
      setSubmit({ status: "failed", reason: "generic" });
      return;
    }
    const { status, body } = answer;

    if (status === 201) {
      const view = AppointmentViewSchema.safeParse(body);
      if (view.success) {
        router.replace(`${ROUTES.bookAppointment}/confirmed/${view.data.reference}`);
        return;
      }
    } else if (status === 422) {
      const parsed = ErrorResponseSchema.safeParse(body);
      if (parsed.success && showServerProblems(parsed.data.error.details ?? [])) return;
    } else if (status === 409) {
      const conflict = BookingConflictSchema.safeParse(body);
      const code = conflict.success ? conflict.data.error.code : null;
      if (conflict.success && (code === "slot_taken" || code === "slot_unavailable")) {
        // Keep every field and the form on screen; the grid is refreshed once the visitor chooses.
        setSubmit({ status: "taken", key: flowKey, message: conflict.data.error.message, alternatives: conflict.data.alternatives ?? [] });
        return;
      }
      setSubmit({ status: "failed", reason: "slot" });
      return;
    }
    setSubmit({ status: "failed", reason: "generic" });
  }

  /** Maps the server's field problems onto the form. Returns false when none of them can be shown. */
  function showServerProblems(details: { field: string; issue: string }[]): boolean {
    if (details.some((detail) => detail.field === "doctorSlug")) {
      setNotice(DOCTOR_GONE_MESSAGE);
      setSubmit({ status: "idle" });
      go({ department: params.department, step: "doctor" });
      return true;
    }
    const fields = details.map((detail) => detail.field).filter(isFormField);
    if (fields.length === 0) return false;
    for (const field of fields) form.setError(field, { type: "server", message: FIELD_MESSAGES[field] });
    const first = (["fullName", "mobile", "email", "reason", "acceptRules"] as const).find((field) => fields.includes(field));
    setSubmit({ status: "idle" });
    if (first) form.setFocus(first);
    return true;
  }

  // The notice belongs to the time that was refused: it goes away once the URL shows another choice.
  const chooseAlternative = (alternative: AlternativeSlot) => {
    setAttempt((count) => count + 1);
    go({ ...params, date: alternative.localDate, time: alternative.localTime, step: "details" }, "replace");
  };
  const seeAllTimes = () => {
    setAttempt((count) => count + 1);
    go({ ...params, step: "time" });
  };

  const taken = submit.status === "taken" && submit.key === flowKey ? submit : null;
  const failure: ReactNode =
    taken ? (
      <SlotTakenNotice message={taken.message} alternatives={taken.alternatives} onChoose={chooseAlternative} onSeeAll={seeAllTimes} />
    ) : submit.status === "failed" ? (
      <div role="alert" className="rounded-card border-2 border-danger-700 bg-danger-50 p-4 text-base">
        {submit.reason === "slot" ? (
          <p>That time is no longer available. Please go back and choose another time.</p>
        ) : (
          <p>
            We couldn&apos;t complete your booking. Please try again, or call the clinic
            {clinicPhone.tel !== "" ? (
              <>
                {" "}
                on{" "}
                <a href={`tel:${clinicPhone.tel}`} className="font-semibold text-navy-900 underline underline-offset-2">
                  {clinicPhone.display}
                </a>
              </>
            ) : null}
            .
          </p>
        )}
      </div>
    ) : null;

  const unavailable = <BookingUnavailable phone={clinicPhone} onRetry={retrySlots} />;
  const noOnlineSlots = <CallClinicNote message={NO_SLOTS_MESSAGE} phone={clinicPhone} />;
  const backButton =
    stepIndex > 0 ? (
      <button type="button" onClick={goBack} className={BUTTON_OUTLINE}>
        Back
      </button>
    ) : null;

  let content: ReactNode;
  switch (params.step) {
    case "department":
      content = <DepartmentStep departments={departments} onSelect={(slug) => go({ department: slug, step: "doctor" })} />;
      break;
    case "doctor":
      content = (
        <>
          {notice ? (
            <p role="status" className="rounded-control border border-danger-700 bg-danger-50 px-4 py-3 text-base font-semibold text-danger-700">
              {notice}
            </p>
          ) : null}
          {departmentDoctors.length === 0 ? (
            noOnlineSlots
          ) : (
            <DoctorStep
              doctors={departmentDoctors}
              onSelect={(slug) => {
                setNotice(null);
                go({ department: params.department, doctor: slug, step: "date" });
              }}
            />
          )}
        </>
      );
      break;
    case "date":
      content = (
        <>
          {doctor ? <p className="text-base text-muted">With {doctor.fullName}</p> : null}
          {slotsFailed ? (
            unavailable
          ) : slotsLoading ? (
            <Skeleton />
          ) : slotData && !slotData.days.some((candidate) => candidate.status === "available") ? (
            noOnlineSlots
          ) : slotData ? (
            <DateStrip days={slotData.days} selected={params.date} onSelect={(date) => go({ ...params, date, time: undefined, step: "date" }, "replace")} />
          ) : null}
        </>
      );
      break;
    case "time":
      content = (
        <>
          {doctor && params.date ? (
            <p className="text-base text-muted">
              With {doctor.fullName}, {formatLocalDate(params.date)}
            </p>
          ) : null}
          {slotsFailed ? (
            unavailable
          ) : slotsLoading ? (
            <Skeleton />
          ) : day && day.slots.length > 0 ? (
            <>
              <p className="text-sm text-muted">All times are in {zoneName}.</p>
              <SlotGrid slots={day.slots} selected={params.time} onSelect={(time) => go({ ...params, time, step: "time" }, "replace")} />
            </>
          ) : slotData ? (
            noOnlineSlots
          ) : null}
        </>
      );
      break;
    case "details":
      content = (
        <>
          {slotsFailed ? (
            unavailable
          ) : slotsLoading ? (
            <Skeleton />
          ) : slotData && !slot ? (
            <p role="status" className="rounded-control border border-danger-700 bg-danger-50 px-4 py-3 text-base font-semibold text-danger-700">
              That time is no longer available. Please go back and choose another time.
            </p>
          ) : slot && doctor && params.date ? (
            <>
              <section aria-labelledby="booking-summary-title" className="max-w-xl rounded-card border border-border bg-surface p-5">
                <h3 id="booking-summary-title" className="text-lg font-bold text-navy-900">
                  Your appointment
                </h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
                  <dt className="text-muted">Doctor</dt>
                  <dd className="font-semibold">{doctor.fullName}</dd>
                  <dt className="text-muted">Department</dt>
                  <dd>{department?.name}</dd>
                  <dt className="text-muted">Date</dt>
                  <dd>{formatLocalDate(params.date)}</dd>
                  <dt className="text-muted">Time</dt>
                  <dd>
                    {slot.localTime} ({zoneName})
                  </dd>
                  <dt className="text-muted">Fee</dt>
                  <dd>{formatPkr(doctor.feePkr)} (sample)</dd>
                </dl>
              </section>
              <DetailsForm form={form} onSubmit={onSubmit} submitting={submit.status === "submitting"} failure={failure} />
            </>
          ) : null}
        </>
      );
      break;
  }

  const showContinue = params.step === "date" || params.step === "time";
  const canContinue = params.step === "date" ? Boolean(params.date && day) : Boolean(params.time && slot);

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator current={params.step} />
      <div data-testid="booking-live" aria-live="polite" className="sr-only">
        Step {stepIndex + 1} of {FLOW_STEPS.length}: {STEP_HEADING[params.step]}
      </div>
      <div ref={stepRef} className="flex flex-col gap-5">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-navy-900 outline-offset-4 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-border-strong md:text-3xl">
          {STEP_HEADING[params.step]}
        </h2>
        {content}
        <div className="flex flex-wrap items-center gap-3">
          {backButton}
          {showContinue ? (
            <button type="button" disabled={!canContinue} onClick={goNext} className={BUTTON_PRIMARY}>
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
