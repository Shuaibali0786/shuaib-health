"use client";

import { useId, useRef, type ReactNode } from "react";

import { useModal } from "./useModal";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** The buttons. Put the safe one first in the DOM only if it should take initial focus. */
  actions: ReactNode;
};

function Modal({ open, onClose, title, children, actions, role }: DialogProps & { role: "dialog" | "alertdialog" }) {
  const titleId = useId();
  const bodyId = useId();
  const safe = useRef<HTMLDivElement>(null);
  // An alert dialog asks a question, so the button marked data-initial-focus (the safe choice) gets focus.
  const panel = useModal(open, onClose, () => safe.current?.querySelector<HTMLElement>("[data-initial-focus]") ?? null);
  if (!open) return null;
  return (
    <>
      <div className="scrim over" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} className="dialog">
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="dialog-body">
          {children}
        </div>
        <div className="acts" ref={safe}>
          {actions}
        </div>
      </div>
    </>
  );
}

/** A dialog that carries information or a form. */
export function Dialog(props: DialogProps) {
  return <Modal {...props} role="dialog" />;
}

/** A dialog that interrupts to ask for a decision (for example "Cancel this booking?"). */
export function AlertDialog(props: DialogProps) {
  return <Modal {...props} role="alertdialog" />;
}
