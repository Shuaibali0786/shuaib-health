import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { SampleBadge } from "@/components/ui/SampleBadge";
import { formatKarachiDate } from "@/lib/format";
import { tipPath } from "@/lib/routes";
import type { HealthTip } from "@/types/content";

/** A sample health-tip card. The title is the link, stretched over the card. */
export function TipCard({ tip }: { tip: HealthTip }) {
  return (
    <Card as="article" interactive className="flex w-full flex-col overflow-hidden">
      <ImageWithFallback image={tip.image} sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-teal-700">
            {tip.category}
          </span>
          {tip.isSample ? <SampleBadge /> : null}
        </div>
        <h3 className="mt-2 text-lg font-bold">
          <Link href={tipPath(tip.slug)} className="after:absolute after:inset-0 after:rounded-card">
            {tip.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-muted">{tip.summary}</p>
        <time dateTime={tip.publishedAt} className="mt-auto pt-4 text-sm text-muted">
          {formatKarachiDate(tip.publishedAt)}
        </time>
      </div>
    </Card>
  );
}
