import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { departmentPath } from "@/lib/routes";
import type { Department } from "@/types/content";

/**
 * One department: photo, name, one line and an arrow. The whole card is a single
 * link (the name is the link text, stretched over the card), so there are no nested links.
 * On phones the card is compact: smaller padding, a two-line summary, no "Learn more" row.
 */
export function DepartmentCard({ department }: { department: Department }) {
  return (
    <Card as="article" interactive className="flex w-full flex-col overflow-hidden">
      <ImageWithFallback
        image={department.image}
        sizes="(min-width: 1280px) 280px, (min-width: 1024px) 30vw, 46vw"
      />
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <h3 className="text-base font-bold sm:text-lg">
          <Link href={departmentPath(department.slug)} className="after:absolute after:inset-0 after:rounded-card">
            {department.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted max-sm:line-clamp-2">{department.summary}</p>
        <span
          aria-hidden="true"
          className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-teal-700 max-sm:hidden"
        >
          Learn more
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Card>
  );
}
