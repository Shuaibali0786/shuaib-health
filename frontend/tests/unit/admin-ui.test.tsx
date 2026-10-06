import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AlertDialog, Dialog } from "@/admin/ui/Dialog";
import { Drawer } from "@/admin/ui/Drawer";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "@/admin/ui/States";
import { VisuallyHidden } from "@/admin/ui/VisuallyHidden";

function DrawerHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open booking</button>
      <button>Other control</button>
      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Ayesha K."
        footer={<button>Mark arrived</button>}
      >
        <button>Reveal phone</button>
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("renders nothing while closed", () => {
    render(<DrawerHarness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a labelled modal dialog and moves focus inside", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open booking" }));
    const dialog = screen.getByRole("dialog", { name: "Ayesha K." });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("keeps Tab and Shift+Tab inside the drawer", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open booking" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 8; i += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes on Escape and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DrawerHarness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open booking" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it("closes from the close button and returns focus", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    const opener = screen.getByRole("button", { name: "Open booking" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("closes when the scrim is clicked", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open booking" }));
    await user.click(screen.getByTestId("drawer-scrim"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not closed by a click inside the panel", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open booking" }));
    await user.click(screen.getByRole("button", { name: "Reveal phone" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("AlertDialog and Dialog", () => {
  function Ask({ role = "alert" }: { role?: "alert" | "plain" }) {
    const [open, setOpen] = useState(false);
    const Component = role === "alert" ? AlertDialog : Dialog;
    return (
      <>
        <button onClick={() => setOpen(true)}>Cancel booking</button>
        <Component
          open={open}
          onClose={() => setOpen(false)}
          title="Cancel this booking?"
          actions={
            <>
              <button>Yes, cancel</button>
              <button data-initial-focus onClick={() => setOpen(false)}>
                Keep booking
              </button>
            </>
          }
        >
          The slot will be offered to other patients.
        </Component>
      </>
    );
  }

  it("is an alertdialog with its question and explanation wired up for screen readers", async () => {
    const user = userEvent.setup();
    render(<Ask />);
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("alertdialog", { name: "Cancel this booking?" });
    expect(dialog).toHaveAccessibleDescription("The slot will be offered to other patients.");
  });

  it("focuses the safe choice first, not the destructive one", async () => {
    const user = userEvent.setup();
    render(<Ask />);
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByRole("button", { name: "Keep booking" })).toHaveFocus();
  });

  it("closes on Escape, returns focus and traps Tab", async () => {
    const user = userEvent.setup();
    render(<Ask />);
    const opener = screen.getByRole("button", { name: "Cancel booking" });
    await user.click(opener);
    const dialog = screen.getByRole("alertdialog");
    for (let i = 0; i < 5; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("a plain Dialog has the dialog role", async () => {
    const user = userEvent.setup();
    render(<Ask role="plain" />);
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByRole("dialog", { name: "Cancel this booking?" })).toBeInTheDocument();
  });
});

describe("states", () => {
  it("Skeleton is decorative and LoadingRegion announces loading once", () => {
    render(
      <LoadingRegion label="Loading overview">
        <Skeleton width={120} height={20} />
        <Skeleton />
      </LoadingRegion>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading overview");
    expect(region.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("EmptyState explains what is missing and can offer an action", () => {
    render(
      <EmptyState title="No bookings match" action={<button>Clear filters</button>}>
        Try a wider date range.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No bookings match" })).toBeInTheDocument();
    expect(screen.getByText("Try a wider date range.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("ErrorState is calm, announced, and retries", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErrorState onRetry={retry} />);
    const alert = screen.getByRole("alert");
    expect(alert).not.toHaveTextContent(/\b(500|502|503|504|error code|exception|stack)\b/i);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("ErrorState without a retry handler has no Retry button", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("VisuallyHidden keeps text for screen readers", () => {
    render(<VisuallyHidden>Only for screen readers</VisuallyHidden>);
    expect(screen.getByText("Only for screen readers")).toHaveClass("sr-only");
  });
});
