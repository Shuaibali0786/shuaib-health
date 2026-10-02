import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Friendly 404. Rendered inside the root layout; never linked from the site. */
export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-20 text-center lg:py-28">
      <h1 className="text-4xl font-extrabold md:text-5xl">Page not found</h1>
      <p className="mt-4 max-w-xl text-base text-muted">
        Sorry, we could not find that page. It may have moved, or the address may be mistyped.
      </p>
      <Button href={ROUTES.home} className="mt-8">
        Back to Home
      </Button>
    </Container>
  );
}
