import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { Container } from "@/components/layout/Container";
import { isDemoEnabled } from "@/lib/demo";
import { DEMO_NOTICE } from "@/lib/honesty";

/**
 * The ONE slim portfolio banner above the header on every public page (owner 2026-11-15; it replaces the two dark bars).
 * It carries the exact demo notice (constitution I: "Portfolio demo — not a real clinic, not medical advice.", also in the
 * footer) and the demo dashboard link. From 640 px the notice is shown in full; on a phone a short form is shown
 * ("Demo — not a real clinic") and the full notice stays as text for screen readers. Server-rendered at a fixed height
 * (h-10) so nothing shifts. White on navy-900 is 15.4:1; gold-300 on navy-900 is above 9:1.
 */
export function AnnouncementBar() {
  if (!isDemoEnabled()) return null;
  return (
    <div className="h-10 border-b-2 border-gold-500 bg-navy-900 text-white" data-testid="announcement-bar">
      <Container className="flex h-full items-center justify-center gap-3 text-[0.8125rem] leading-none">
        <p className="min-w-0 truncate">
          <span className="sm:hidden" aria-hidden="true">Demo — not a real clinic</span>
          <span className="sr-only sm:not-sr-only">{DEMO_NOTICE}</span>
        </p>
        <DemoDashboardButton className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-control border border-gold-300 px-3 text-[0.8125rem] font-semibold text-gold-300 transition-colors duration-150 hover:bg-gold-300 hover:text-navy-900">
          <span className="sm:hidden">Demo dashboard</span>
          <span className="hidden sm:inline">View Demo Dashboard</span>
          <span aria-hidden="true">→</span>
        </DemoDashboardButton>
      </Container>
    </div>
  );
}
