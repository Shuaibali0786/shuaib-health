import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgendaViewToggle } from "@/admin/overview/AgendaViewToggle";
import { AUTO_RETRIES, FORGET_AFTER_MS, nextRetry, resetRetries } from "@/admin/state/retry";

describe("automatic retries of a failed screen", () => {
  beforeEach(() => resetRetries());

  it("retries twice, after 1.5 s and then 3 s, and then leaves it to the Retry button", () => {
    expect(nextRetry(1000)).toBe(1500);
    expect(nextRetry(2000)).toBe(3000);
    expect(nextRetry(3000)).toBeNull();
    expect(AUTO_RETRIES).toBe(2);
  });

  it("the Retry button starts the sequence over", () => {
    nextRetry(1000);
    nextRetry(2000);
    resetRetries();
    expect(nextRetry(3000)).toBe(1500);
  });

  it("forgets after a quiet minute", () => {
    nextRetry(1000);
    nextRetry(2000);
    expect(nextRetry(2000 + FORGET_AFTER_MS + 1)).toBe(1500);
  });
});

describe("the agenda's Timeline / List switch", () => {
  it("marks the chosen view as pressed and reports a change", () => {
    const onChange = vi.fn();
    render(<AgendaViewToggle view="timeline" onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Agenda view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});
