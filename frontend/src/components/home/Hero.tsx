import { CalendarCheck, Stethoscope } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { buildHeroFacts, heroImage } from "@/data/homeContent";
import { getSiteConfig } from "@/lib/content";
import { ROUTES } from "@/lib/routes";

/**
 * The three fact cards sit on the photo's edges at every width, never over the doctor's face (owner test 2026-11-09:
 * "Lab reports online" covered it): opening hours inside the photo's top-left corner (left of the hair), lab reports inside the
 * photo at the lower left, a third up from the bottom (owner 2026-11-09), home sample collection on the bottom-right edge (the desk), raised above the fixed
 * "Ask us" button. Checked at 1920, 1366, 768 and 390 px by tests/e2e/hero-face.spec.ts.
 */
const FACT_POSITION = [
  // Owner 2026-11-09 (final polish): fully inside the photo's top-left corner, narrow enough to stay left of the hair.
  "top-3 left-3 max-w-[40%] sm:top-4 sm:left-4 sm:max-w-[11rem] lg:top-5 lg:left-5 lg:max-w-[12rem]",
  // Owner 2026-11-09: inside the photo, lower-left, about a third up from the bottom (left of and below the face).
  // (A little higher on a tablet, where the photo is narrow and the right-hand card sits higher.)
  "bottom-[30%] left-3 max-w-[50%] sm:bottom-[38%] sm:left-4 sm:max-w-[16rem] lg:bottom-[30%] lg:left-5",
  // 76 px up on a phone: below "Ask us" on the first screen, and above it once the photo is scrolled fully into view.
  "bottom-[4.75rem] right-2 max-w-[50%] sm:bottom-32 sm:max-w-[16rem] lg:bottom-28 lg:-right-6",
];

/**
 * First screen of the Home page. It is never wrapped in Reveal (nothing is hidden
 * before hydration), and the photo is the only image loaded with priority.
 * The three cards state only demo-true facts: no counts, awards or ratings.
 */
export async function Hero() {
  const { openingHours } = await getSiteConfig();
  const heroFacts = buildHeroFacts(openingHours);
  return (
    <section aria-labelledby="hero-title" className="bg-soft-gradient">
      <Container className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14 lg:py-14">
        {/* On large screens the text starts near the top of the tall photo (lg:pt-16) instead of floating in the middle of it. */}
        <div className="min-w-0 lg:pt-16">
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

        <div className="relative mx-auto mt-6 w-full min-w-0 max-w-md lg:mt-0 lg:max-w-none">
          {/* On large screens the photo is a little shorter (only the desk is cropped, from the bottom) so all of it, and
              all three cards, fit the first screen of a 1366 x 768 laptop. */}
          <div className="overflow-hidden rounded-card shadow-lift lg:aspect-[0.92]">
            <ImageWithFallback image={heroImage} sizes="(min-width: 1024px) 560px, 90vw" priority className="lg:h-full lg:object-cover lg:object-top" />
          </div>
          <ul>
            {heroFacts.map((fact, index) => (
              <Card
                as="li"
                key={fact.id}
                className={`hero-float hero-float-${index + 1} !absolute flex items-center gap-2 p-2 pr-3 shadow-lift ${index === 0 ? "" : "sm:gap-3 sm:p-3 sm:pr-4"} ${FACT_POSITION[index] ?? ""}`}
              >
                {/* The opening-hours card sits in the photo's corner beside the face: compact (two short lines, no icon on a
                    phone) so it stays clear of the hair at every width. */}
                <IconTile name={fact.iconName} className={index === 0 ? "!size-9 max-sm:!hidden [&_svg]:size-5" : "!size-9 sm:!size-12 [&_svg]:size-5 sm:[&_svg]:size-6"} />
                <span className={`text-balance text-xs font-semibold leading-snug text-navy-900 ${index === 0 ? "lg:text-sm" : "sm:text-sm"}`}>{fact.label}</span>
              </Card>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
