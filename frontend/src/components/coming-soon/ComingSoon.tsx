import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

/** Placeholder for pages that are not built in the demo yet. Never a 404. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="bg-soft-gradient">
      <Container className="flex flex-col items-center py-20 text-center lg:py-28">
        <p className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-700">{title}</p>
        <h1 className="text-4xl font-extrabold md:text-5xl">Coming soon</h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          This page is not built in the demo yet. Please check back later, or head back to the home page.
        </p>
        <Button href={ROUTES.home} className="mt-8">
          Back to Home
        </Button>
      </Container>
    </div>
  );
}
