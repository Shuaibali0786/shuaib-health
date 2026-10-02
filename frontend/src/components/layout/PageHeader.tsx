import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs, type Crumb } from "@/components/layout/Breadcrumbs";

interface PageHeaderProps {
  /** Breadcrumb trail after "Home"; the last item is this page. */
  trail: Crumb[];
  title: string;
  intro?: string;
  eyebrow?: string;
  /** Extra content under the intro, for example a sample note or action buttons. */
  children?: ReactNode;
}

/** Top of every inner page: breadcrumb, the page's only h1, an intro, and an optional slot. */
export function PageHeader({ trail, title, intro, eyebrow, children }: PageHeaderProps) {
  return (
    <div className="bg-soft-gradient">
      <Container className="py-8 md:py-12">
        <Breadcrumbs items={trail} />
        {eyebrow ? (
          <p className="mt-6 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-700">{eyebrow}</p>
        ) : null}
        <h1 className={eyebrow ? "mt-2 text-3xl font-extrabold md:text-5xl" : "mt-6 text-3xl font-extrabold md:text-5xl"}>{title}</h1>
        {intro ? <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">{intro}</p> : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </Container>
    </div>
  );
}
