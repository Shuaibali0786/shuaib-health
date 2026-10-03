import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

interface ComingSoonProps {
  title: string;
  /** The page's h1. Defaults to "Coming soon". */
  heading?: string;
  /** One sentence under the heading. */
  message?: string;
  /** An optional second link, for example back to the doctors list. */
  secondary?: { label: string; href: string };
}

/** Placeholder for pages that are not built in the demo yet. Never a 404. */
export function ComingSoon({
  title,
  heading = "Coming soon",
  message = "This page is not built in the demo yet. Please check back later, or head back to the home page.",
  secondary,
}: ComingSoonProps) {
  return (
    <div className="bg-soft-gradient">
      <Container className="flex flex-col items-center py-20 text-center lg:py-28">
        <p className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-700">{title}</p>
        <h1 className="text-4xl font-extrabold md:text-5xl">{heading}</h1>
        <p className="mt-4 max-w-xl text-base text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href={ROUTES.home}>Back to Home</Button>
          {secondary ? (
            <Button href={secondary.href} variant="outline">
              {secondary.label}
            </Button>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
