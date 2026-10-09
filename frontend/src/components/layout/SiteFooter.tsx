import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { Container } from "@/components/layout/Container";
import { footerQuickLinks, legalLinks } from "@/data/navigation";
import { getDepartments, getSiteConfig } from "@/lib/content";
import { formatOpeningHours } from "@/lib/format";
import { CREDIT, DEMO_NOTICE } from "@/lib/honesty";
import { departmentPath, linkPrefetch } from "@/lib/routes";

/** Fixed at build time (not new Date()) so server and client markup never differ. */
const COPYRIGHT_YEAR = 2026;

const COLUMN_HEADING = "mb-4 text-base font-bold text-white";
const FOOTER_LINK = "inline-block py-1 text-white underline-offset-4 hover:text-teal-300 hover:underline";

/**
 * Four-column footer on navy-900 (white 15.4:1, teal-300 10.4:1). It repeats the
 * demo notice in the bottom row, so the disclaimer is on screen even after the
 * top bar has scrolled away, and carries the author credit (constitution I).
 */
export async function SiteFooter() {
  const [site, departments] = await Promise.all([getSiteConfig(), getDepartments()]);

  return (
    <footer className="on-dark bg-navy-900 text-white">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" aria-label={`${site.name} home`} className="inline-block rounded-control">
              <Logo size="md" variant="night" />
            </Link>
            <p className="mt-4 max-w-xs text-base">
              A calm, modern clinic and diagnostic lab website for Karachi. This is a portfolio demo and not a real
              clinic.
            </p>
          </div>

          <nav aria-label="Quick links">
            <h2 className={COLUMN_HEADING}>Quick links</h2>
            <ul>
              {footerQuickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch={linkPrefetch(link.href)} className={FOOTER_LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Departments">
            <h2 className={COLUMN_HEADING}>Departments</h2>
            <ul>
              {departments.map((department) => (
                <li key={department.id}>
                  <Link href={departmentPath(department.slug)} className={FOOTER_LINK}>
                    {department.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className={COLUMN_HEADING}>Contact</h2>
            <p className="mb-3 inline-flex rounded-pill border border-teal-300 px-2.5 py-0.5 text-sm font-semibold text-teal-300">
              Sample details
            </p>
            {site.address.length > 0 ? (
              <address className="not-italic">
                {site.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : null}
            <ul className="mt-3 space-y-1">
              {site.generalPhone.tel !== "" ? (
                <li>
                  <a href={`tel:${site.generalPhone.tel}`} className={FOOTER_LINK}>
                    {site.generalPhone.display}
                  </a>
                </li>
              ) : null}
              {site.openingHours.length > 0 ? (
                <li>
                  <span className="block text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-300">
                    Hours
                  </span>
                  {formatOpeningHours(site.openingHours)}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/20 pt-6 text-sm lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {COPYRIGHT_YEAR} {site.name}
          </p>
          <ul className="flex flex-wrap gap-x-5">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={FOOTER_LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p>{DEMO_NOTICE}</p>
          <p>
            <PoweredBy tone="night" />
          </p>
          <p>
            <a
              href={CREDIT.href}
              rel="noopener noreferrer"
              className="inline-block py-1 underline underline-offset-4 hover:text-teal-300"
            >
              {CREDIT.text}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
