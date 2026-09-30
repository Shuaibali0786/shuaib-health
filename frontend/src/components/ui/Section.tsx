import type { ComponentPropsWithoutRef } from "react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/cn";

type SectionTone = "background" | "surface" | "none";

interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "aria-labelledby"> {
  /** id of the section's heading, so the section gets an accessible name. */
  labelledBy?: string;
  /** "none" leaves the background to the caller (gradient bands). */
  tone?: SectionTone;
  containerClassName?: string;
}

const TONE_CLASS: Record<SectionTone, string> = {
  background: "bg-background",
  surface: "bg-surface",
  none: "",
};

/** A page section: vertical rhythm (4rem, 6rem from lg), background tone, and a Container. */
export function Section({
  labelledBy,
  tone = "background",
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section aria-labelledby={labelledBy} className={cn("py-16 lg:py-24", TONE_CLASS[tone], className)} {...props}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
