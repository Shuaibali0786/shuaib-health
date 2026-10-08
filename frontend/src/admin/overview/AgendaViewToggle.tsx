"use client";

export type AgendaView = "timeline" | "list";

const CHOICES: readonly { view: AgendaView; label: string }[] = [
  { view: "timeline", label: "Timeline" },
  { view: "list", label: "List" },
];

/**
 * Today's agenda on a wide screen is a timeline; "List" shows the same bookings as the phone's collapsible
 * doctor lists, which is easier to scan by name and to use with a keyboard. Both read the same bookings, so
 * a number never differs between them. Phones always get the list and have no switch.
 */
export function AgendaViewToggle({ view, onChange }: { view: AgendaView; onChange: (view: AgendaView) => void }) {
  return (
    <div className="seg" role="group" aria-label="Agenda view" data-testid="agenda-view">
      {CHOICES.map((choice) => (
        <button key={choice.view} type="button" aria-pressed={view === choice.view} data-agenda-view={choice.view} onClick={() => onChange(choice.view)}>
          {choice.label}
        </button>
      ))}
    </div>
  );
}
