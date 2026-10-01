import type { ComponentPropsWithoutRef } from "react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/cn";

type SectionTone = "background" | "surface" | "none";

interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "aria-labelledby"> {
  /** id of the section's heading, so the section gets an accessible name. */
  labelledBy?: string;
  /** "none" leaves the background to the caller (gradient bands). */
  tone?: SectionTone;
  /** "compact" is for slim bands such as the facts band. */
  spacing?: "default" | "compact";
  containerClassName?: string;
}

const SPACING_CLASS = {
  default: "py-16 lg:py-24",
  compact: "py-10 lg:py-14",
} as const;

const TONE_CLASS: Record<SectionTone, string> = {
  background: "bg-background",
  surface: "bg-surface",
  none: "",
};

/** A page section: vertical rhythm (4rem, 6rem from lg), background tone, and a Container. */
export function Section({
  labelledBy,
  tone = "background",
  spacing = "default",
  className,
  containerClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section aria-labelledby={labelledBy} className={cn(SPACING_CLASS[spacing], TONE_CLASS[tone], className)} {...props}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
