import { cn } from "@/lib/cn";

type Subject = "facility" | "person";

const TEXT: Record<Subject, string> = {
  facility: "Illustrative image, not our actual facility.",
  person: "Stock photo of a model. Sample profile — name and details are fictional.",
};

/** A small caption for stock photos that stand in for a facility or a person (constitution I). */
export function IllustrativeNote({ subject, className }: { subject: Subject; className?: string }) {
  return <p className={cn("text-sm text-muted", className)}>{TEXT[subject]}</p>;
}
