"use client";

import { Menu, Phone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/routes";
import type { NavItem, PhoneNumber } from "@/types/content";
import { NavLinks } from "./NavLinks";

interface MobileMenuProps {
  items: NavItem[];
  emergencyPhone: PhoneNumber;
}

const PANEL_ID = "mobile-menu";

/**
 * Hamburger button plus a disclosure panel under the sticky header (below 1280 px).
 * - aria-expanded / aria-controls on the button, with a name that changes ("Open menu" / "Close menu")
 * - Escape closes it and returns focus to the button; so does tapping outside it
 * - It remembers the path it was opened on, so any navigation closes it without an effect
 * The panel is positioned against the header (a sticky ancestor), so keep this
 * component's parent un-positioned.
 */
export function MobileMenu({ items, emergencyPhone }: MobileMenuProps) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpenPath(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenPath(open ? null : pathname)}
        className="inline-flex size-11 items-center justify-center rounded-control text-navy-900 transition-colors hover:bg-surface xl:hidden"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
      </button>

      <div
        id={PANEL_ID}
        ref={panelRef}
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-white shadow-lift md:max-h-[calc(100dvh-4.5rem)] xl:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto w-full max-w-page px-4 py-4 md:px-6">
          <NavLinks items={items} layout="stacked" />
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <a
              href={`tel:${emergencyPhone.tel}`}
              className="flex min-h-12 items-center gap-3 rounded-control px-4 font-semibold text-navy-900 hover:bg-surface"
            >
              <Phone className="size-5 text-danger-700" aria-hidden="true" />
              <span className="flex flex-col leading-tight">
                <span className="text-[0.8125rem] font-medium text-muted">Emergency (sample)</span>
                <span>{emergencyPhone.display}</span>
              </span>
            </a>
            <Button href={ROUTES.bookAppointment} variant="accent" fullWidth>
              Book Appointment
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
}
