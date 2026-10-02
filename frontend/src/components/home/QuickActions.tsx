import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { quickActions } from "@/data/homeContent";
import { cn } from "@/lib/cn";
import { REVEAL_STAGGER } from "@/lib/motion";

/**
 * "How can we help you?" (FR-012): five actions in the required order. Two columns on
 * phones (the fifth spans both), five in a row from lg. Each card is one link.
 */
export function QuickActions() {
  return (
    <Section labelledBy="quick-actions-title">
      <Reveal>
        <SectionHeading
          id="quick-actions-title"
          title="How can we help you?"
          intro="Start with what you need today."
          align="center"
        />
      </Reveal>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {quickActions.map((action, index) => (
          <Reveal
            as="li"
            key={action.id}
            delay={index * REVEAL_STAGGER}
            className={cn("flex", index === quickActions.length - 1 && "col-span-2 lg:col-span-1")}
          >
            <Card interactive className="w-full">
              <Link href={action.href} className="flex h-full flex-col items-start gap-2 rounded-card p-3 sm:gap-3 sm:p-5">
                <IconTile name={action.iconName} className="max-sm:size-10" />
                <span className="font-heading text-base font-bold text-navy-900">{action.label}</span>
                <span className="text-sm text-muted">{action.description}</span>
              </Link>
            </Card>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
