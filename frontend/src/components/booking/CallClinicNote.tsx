import type { PhoneNumber } from "@/types/content";

const LINK =
  "inline-flex min-h-11 items-center justify-center rounded-control border-2 border-navy-900 bg-white px-5 py-2.5 text-base font-semibold text-navy-900 transition-colors hover:bg-surface";

/** A message plus a `tel:` link to the clinic. The link is left out when no phone number is known. */
export function CallClinicNote({ message, phone }: { message: string; phone: PhoneNumber }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-5">
      <p className="text-base font-semibold text-navy-900">{message}</p>
      {phone.tel !== "" ? (
        <a href={`tel:${phone.tel}`} className={LINK}>
          Call {phone.display}
        </a>
      ) : null}
    </div>
  );
}
