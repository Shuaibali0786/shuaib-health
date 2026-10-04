import { Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { getSiteConfig } from "@/lib/content";

/**
 * Emergency card: the sample emergency number as a tap-to-call link, plus clear advice
 * to go to the nearest emergency room. The number is labelled as a sample because this
 * is a demo and it must never look like a real helpline.
 * Colours: danger-700 on danger-50 is 6.6:1; the button is white on danger-700 (6.6:1).
 */
export async function EmergencyCard() {
  const { emergencyPhone } = await getSiteConfig();

  return (
    <aside
      aria-labelledby="emergency-title"
      className="flex flex-col gap-5 rounded-card border border-danger-700/30 bg-danger-50 p-6 shadow-soft md:flex-row md:items-center md:justify-between md:p-8"
    >
      <div className="flex gap-4">
        <IconTile name="siren" tone="danger" />
        <div>
          <h3 id="emergency-title" className="text-xl font-bold text-danger-700">
            In an emergency
          </h3>
          <p className="mt-1 max-w-xl text-base text-ink">
            If you or someone else needs urgent help, go to the nearest emergency room right away.
          </p>
          <p className="mt-2 text-sm text-muted">
            This is a demo. The number shown is a sample and does not reach a real clinic.
          </p>
        </div>
      </div>
      {emergencyPhone.tel !== "" ? (
        <Button href={`tel:${emergencyPhone.tel}`} variant="danger" className="shrink-0">
          <Phone className="size-5" aria-hidden="true" />
          <span>
            {emergencyPhone.display} <span className="font-medium">(sample)</span>
          </span>
        </Button>
      ) : null}
    </aside>
  );
}
