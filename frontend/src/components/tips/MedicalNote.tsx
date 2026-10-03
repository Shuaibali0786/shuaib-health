import { Info } from "lucide-react";

/** The standing note under every article: it is general information, and a doctor is the person to ask. */
export function MedicalNote() {
  return (
    <aside aria-label="Medical note" className="flex max-w-2xl gap-3 rounded-card border border-border bg-surface p-4 text-sm text-ink">
      <Info className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-navy-900">General information, not medical advice.</strong> This sample article cannot
        replace a conversation with your doctor. If you have a health concern, please ask a doctor.
      </p>
    </aside>
  );
}
