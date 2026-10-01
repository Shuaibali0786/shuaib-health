import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { ROUTES } from "@/lib/routes";

/** Closing call to action (FR-018). White on navy, and the accent button is navy on teal; focus rings use the on-dark colour. */
export function CtaBand() {
  return (
    <Section labelledBy="cta-title" tone="none" className="on-dark bg-deep-gradient" containerClassName="text-center">
      <h2 id="cta-title" className="text-[1.75rem] font-bold text-white md:text-4xl">
        Book your appointment
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-base text-white">Choose a doctor and a time that works for you.</p>
      <Button href={ROUTES.bookAppointment} variant="accent" className="mt-8">
        <CalendarCheck className="size-5" aria-hidden="true" />
        Book Appointment
      </Button>
    </Section>
  );
}
