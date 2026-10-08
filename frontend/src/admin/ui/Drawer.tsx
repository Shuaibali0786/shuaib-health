"use client";

import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useModal } from "./useModal";

/**
 * A side sheet on screens of 901 px and up, a bottom sheet below (the CSS decides). Focus moves in,
 * Tab stays inside, Escape and the scrim close it, and focus goes back to the opener. The scrim hides
 * the page from pointer users; `aria-modal` hides it from screen readers.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** A small line above the title, for example the status pill or the booking reference. */
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useModal(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" data-testid="drawer-scrim" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="drawer">
        <div className="dr-head">
          <div className="top">
            {eyebrow}
            <button type="button" className="x" onClick={onClose} aria-label="Close">
              <X className="i" aria-hidden="true" />
            </button>
          </div>
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="dr-body">{children}</div>
        {footer}
      </div>
    </>
  );
}
