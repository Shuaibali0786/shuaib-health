import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { Container } from "@/components/layout/Container";
import { isDemoEnabled } from "@/lib/demo";

/**
 * The ONE slim portfolio banner above the header on every public page (owner 2026-11-15; it replaces the two dark bars).
 * It says this is a demo, not a real clinic (constitution I; the footer keeps the full notice), and holds the demo
 * dashboard link. Server-rendered at a fixed height (h-10) so nothing shifts. The button is the same form POST as the
 * footer's. White on navy-900 is 15.4:1; gold-300 on navy-900 is above 9:1.
 */
export function AnnouncementBar() {
  if (!isDemoEnabled()) return null;
  return (
    <div className="h-10 border-b-2 border-gold-500 bg-navy-900 text-white" data-testid="announcement-bar">
      <Container className="flex h-full items-center justify-center gap-3 text-[0.8125rem] leading-none">
        <p className="min-w-0 truncate">
          <span className="sm:hidden">Demo — not a real clinic</span>
          <span className="hidden sm:inline">Portfolio demo — not a real clinic</span>
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
