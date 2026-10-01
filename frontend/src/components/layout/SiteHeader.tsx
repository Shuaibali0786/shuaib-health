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
 * Sticky header (4 rem tall on phones, 4.5 rem from md; globals.css uses 4.5 rem
 * as scroll-padding-top so focused elements are never hidden under it).
 * - below 768 px: logo, call icon, compact "Book" button (from 375 px), menu button
 * - 768 to 1279 px: logo, emergency phone, Book Appointment, menu button
 * - 1280 px and up: logo, the eight links, emergency phone, Book Appointment
 */
export async function SiteHeader() {
  const { emergencyPhone } = await getSiteConfig();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <Container wide className="flex h-16 items-center gap-3 md:h-[4.5rem]">
        <Link href={ROUTES.home} aria-label="Shuaib Health home" className="shrink-0 rounded-control">
          <Logo size="md" />
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 justify-center xl:flex">
          <NavLinks items={primaryNav} layout="inline" />
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <a
            href={`tel:${emergencyPhone.tel}`}
            aria-label="Call emergency phone"
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
              <span className="text-[0.8125rem] font-medium text-muted">Emergency</span>
              <span className="whitespace-nowrap text-sm">{emergencyPhone.display}</span>
            </span>
          </a>
          <Button
            href={ROUTES.bookAppointment}
            variant="accent"
            size="sm"
            aria-label="Book Appointment"
            className="max-[374px]:hidden"
          >
            <span className="md:hidden">Book</span>
            <span className="hidden md:inline">Book Appointment</span>
          </Button>
          <MobileMenu items={primaryNav} emergencyPhone={emergencyPhone} />
        </div>
      </Container>
    </header>
  );
}
