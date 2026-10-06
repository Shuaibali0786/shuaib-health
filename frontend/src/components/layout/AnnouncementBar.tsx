import { DemoDashboardButton } from "@/components/demo/DemoDashboardButton";
import { Container } from "@/components/layout/Container";

/**
 * Slim portfolio announcement above the header on every public page. Server-rendered at a fixed
 * height (h-10) so nothing shifts. The button is the same form POST as the footer's; the wording
 * shortens on phones. White on navy-900 is 15.4:1; gold-300 on navy-900 is above 9:1.
 */
export function AnnouncementBar() {
  return (
    <div className="h-10 border-b-2 border-gold-500 bg-navy-900 text-white" data-testid="announcement-bar">
      <Container className="flex h-full items-center justify-center gap-3 text-[0.8125rem] leading-none">
        <p className="hidden min-w-0 truncate sm:block">Portfolio demo — see how the clinic team runs everything</p>
        <DemoDashboardButton className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-control border border-gold-300 px-3 text-[0.8125rem] font-semibold text-gold-300 transition-colors duration-150 hover:bg-gold-300 hover:text-navy-900">
          <span className="sm:hidden">See the clinic dashboard</span>
          <span className="hidden sm:inline">View Demo Dashboard</span>
          <span aria-hidden="true">→</span>
        </DemoDashboardButton>
      </Container>
    </div>
  );
}
