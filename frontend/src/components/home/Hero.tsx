import { CalendarCheck, Stethoscope } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { heroFacts, heroImage } from "@/data/homeContent";
import { ROUTES } from "@/lib/routes";

/** On large screens the three fact cards float over the photo's edges; below that they stack under it. */
const FACT_POSITION = [
  "lg:absolute lg:-left-10 lg:top-12",
  "lg:absolute lg:-right-4 lg:top-1/2",
  "lg:absolute lg:-bottom-6 lg:left-8",
];

/**
 * First screen of the Home page. It is never wrapped in Reveal (nothing is hidden
 * before hydration), and the photo is the only image loaded with priority.
 * The three cards state only demo-true facts: no counts, awards or ratings.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-soft-gradient">
      <Container className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div className="min-w-0">
          <p className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-700">
            Clinic &amp; Diagnostics, Karachi
          </p>
          <h1 id="hero-title" className="text-[2.25rem] font-extrabold md:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
            Care that feels calm and clear
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Find a doctor, book an appointment and see our lab tests, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={ROUTES.bookAppointment} variant="accent">
              <CalendarCheck className="size-5" aria-hidden="true" />
              Book Appointment
            </Button>
            <Button href={ROUTES.doctors} variant="outline">
              <Stethoscope className="size-5" aria-hidden="true" />
              Find a Doctor
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none">
          <div className="overflow-hidden rounded-card shadow-lift">
            <ImageWithFallback image={heroImage} sizes="(min-width: 1024px) 480px, 90vw" priority />
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:block">
            {heroFacts.map((fact, index) => (
              <Card
                as="li"
                key={fact.id}
                className={`flex items-center gap-3 p-3 pr-4 shadow-lift lg:max-w-[19rem] ${FACT_POSITION[index] ?? ""}`}
              >
                <IconTile name={fact.iconName} />
                <span className="text-balance text-sm font-semibold leading-snug text-navy-900">{fact.label}</span>
              </Card>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
