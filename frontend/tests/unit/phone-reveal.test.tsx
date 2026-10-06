import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MASK_AFTER_MS, PhoneReveal } from "@/admin/bookings/PhoneReveal";

const answer = { phone: "0300 1234567", telHref: "tel:+923001234567", maskAfterSeconds: 60 };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe("PhoneReveal", () => {
  it("shows the masked number and no Call link until revealed", () => {
    render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    expect(screen.getByTestId("phone").textContent).toBe("0300****567");
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
  });

  it("reveals through a POST, then offers a tel: Call link", async () => {
    render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    await user().click(screen.getByRole("button", { name: "Reveal" }));
    expect(await screen.findByText("0300 1234567")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+923001234567");
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("/api/admin/bookings/RAYESHA001/reveal-phone");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("masks again after 60 seconds, not before", async () => {
    render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    await user().click(screen.getByRole("button", { name: "Reveal" }));
    await screen.findByText("0300 1234567");
    await act(async () => void vi.advanceTimersByTime(MASK_AFTER_MS - 1000));
    expect(screen.getByTestId("phone").textContent).toBe("0300 1234567");
    await act(async () => void vi.advanceTimersByTime(1500));
    expect(screen.getByTestId("phone").textContent).toBe("0300****567");
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
  });

  it("masks again when closed (unmounted): a reopened drawer starts masked", async () => {
    const { unmount } = render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    await user().click(screen.getByRole("button", { name: "Reveal" }));
    await screen.findByText("0300 1234567");
    unmount();
    render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    expect(screen.getByTestId("phone").textContent).toBe("0300****567");
  });

  it("says so calmly when the reveal fails and stays masked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "forbidden", message: "x", requestId: "r" } }), { status: 403 }));
    render(<PhoneReveal reference="RAYESHA001" masked="0300****567" />);
    await user().click(screen.getByRole("button", { name: "Reveal" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("phone").textContent).toBe("0300****567");
  });
});
