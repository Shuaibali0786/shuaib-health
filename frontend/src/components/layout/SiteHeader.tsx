import { Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { primaryNav } from "@/data/navigation";
import { getSiteConfig } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

/**
 * Sticky header (at least 4 rem tall on phones, 4.5 rem from md; if text is enlarged or spaced out
 * so the items no longer fit one row, the right-hand group wraps to a second row instead of
 * overflowing off screen; globals.css uses 4.5 rem
 * as scroll-padding-top so focused elements are never hidden under it).
 * - below 768 px: logo, call icon, compact "Book" button (from 375 px), menu button
 * - 768 to 1279 px: logo, emergency phone, Book Appointment, menu button
 * - 1280 px and up: logo, the eight links, emergency phone, Book Appointment
 */
export async function SiteHeader() {
  const { emergencyPhone, name } = await getSiteConfig();
  // The neutral identity has no phone numbers, so the phone UI is left out (never an empty tel: link).
  const hasPhone = emergencyPhone.tel !== "";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <Container wide className="flex min-h-16 flex-wrap items-center gap-x-2 gap-y-1 py-1 sm:gap-x-3 md:min-h-[4.5rem]">
        <Link href={ROUTES.home} aria-label={`${name} home`} className="shrink-0 rounded-control">
          <Logo size="md" />
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 justify-center xl:flex">
          <NavLinks items={primaryNav} layout="inline" />
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          {hasPhone ? (
            <>
              <a
                href={`tel:${emergencyPhone.tel}`}
                aria-label="Call emergency phone (sample number)"
                className="inline-flex size-11 items-center justify-center rounded-control text-danger-700 hover:bg-surface md:hidden"
              >
                <Phone className="size-5" aria-hidden="true" />
              </a>
              <a
                href={`tel:${emergencyPhone.tel}`}
                className="hidden items-center gap-2 rounded-control px-2 py-1 text-navy-900 hover:bg-surface md:inline-flex"
              >
                <Phone className="size-5 shrink-0 text-danger-700" aria-hidden="true" />
                <span className="flex flex-col font-semibold leading-tight">
                  <span className="text-[0.8125rem] font-medium text-muted">Emergency (sample)</span>
                  <span className="whitespace-nowrap text-sm">{emergencyPhone.display}</span>
                </span>
              </a>
            </>
          ) : null}
          <Button
            href={ROUTES.bookAppointment}
            variant="accent"
            size="sm"
            aria-label="Book Appointment"
            className="max-sm:px-3 max-[374px]:hidden"
          >
            <span className="md:hidden">Book</span>
            <span className="hidden md:inline">Book Appointment</span>
          </Button>
          <MobileMenu items={primaryNav} emergencyPhone={hasPhone ? emergencyPhone : undefined} />
        </div>
      </Container>
    </header>
  );
}
