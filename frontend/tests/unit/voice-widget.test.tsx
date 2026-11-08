// Feature 013: the voice receptionist inside the chat widget (jsdom, scripted speech, fake booking route).
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantLauncher } from "@/components/agent/AssistantLauncher";
import type { FakeSpeech } from "@/voice/fakeSpeech";

import { NOW, bookedView, fakeSlots, packFor } from "../voice/harness";

const g = globalThis as unknown as { __fakeSpeech?: FakeSpeech; __posts?: unknown[] };
const port = () => g.__fakeSpeech as FakeSpeech;

vi.mock("@/voice/browserSpeech", async () => {
  const { createFakeSpeech } = await import("@/voice/fakeSpeech");
  const fake = createFakeSpeech({ autoFinish: true, voices: [{ name: "Microsoft Neerja Online (Natural) - English (India)", lang: "en-IN", local: false }] });
  g.__fakeSpeech = fake;
  return { createBrowserSpeech: () => fake };
});

vi.mock("@/lib/booking/client", async () => {
  const harness = await import("../voice/harness");
  g.__posts = [];
  return {
    fetchSlots: async (slug: string) => harness.fakeSlots(slug),
    postBooking: async (payload: { doctorSlug: string; startsAt: string }) => {
      g.__posts?.push(payload);
      return { status: 201, retryAfter: null, body: harness.bookedView(harness.packFor(false), payload as never) };
    },
  };
});

beforeAll(() => {
  // jsdom has no canvas; the orb then simply does not draw (the state text still tells the story).
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  g.__posts = [];
});
afterEach(() => vi.useRealTimers());

const pack = packFor(false);

async function openVoiceByBubble(user: ReturnType<typeof userEvent.setup>) {
  render(<AssistantLauncher pack={pack} voice />);
  const bubble = await screen.findByRole("button", { name: /Talk to us/ }, { timeout: 4000 });
  await user.click(bubble);
  return screen.findByRole("dialog", { name: /Ask Shuaib Health/ });
}

describe("flag off (the default)", () => {
  it("shows no bubble, no Mic and no Voice mode button", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /Talk to us/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Dictate/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /voice mode/i })).toBeNull();
  });
});

describe("discovery and entry points", () => {
  it("the bubble can be dismissed, and the chat shows Mic and Voice mode beside Send", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    const bubble = await screen.findByRole("button", { name: /Talk to us/ }, { timeout: 4000 });
    expect(bubble).toHaveTextContent("English");
    await user.click(screen.getByRole("button", { name: "Dismiss the voice invitation" }));
    expect(screen.queryByRole("button", { name: /Talk to us/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("button", { name: /Dictate your question/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Start voice mode/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("Mic dictates into the box for editing and sends nothing", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /Dictate your question/ }));
    act(() => port().hear("what are your timings", { interim: true }));
    expect(within(dialog).getByLabelText("Your question")).toHaveValue("what are your timings");
    expect(within(dialog).getAllByRole("log")[0]?.textContent).not.toMatch(/Mon–Sat/);
  });
});

describe("voice mode", () => {
  it("opens from the bubble with the orb, state, controls and the greeting, and answers by voice", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    expect(await within(dialog).findByTestId("voice-mode")).toBeInTheDocument();
    expect(within(dialog).getByTestId("voice-orb")).toBeInTheDocument();
    expect(await within(dialog).findByText(/Listening/)).toBeInTheDocument();
    const log = within(dialog).getByRole("log");
    expect(log).toHaveTextContent("I'm an AI");
    expect(log).toHaveTextContent("never record or store your audio");

    for (const name of ["Mute", "Interrupt", "EN", "اردو", "Female", "Male", "End"]) {
      expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
    }
    act(() => port().hear("What are your timings?", { interim: true }));
    await waitFor(() => expect(log).toHaveTextContent("Mon–Sat, 9 AM – 9 PM"));
    expect(port().spoken.some((s) => s.text.includes("9 AM"))).toBe(true);
  });

  it("the controls work: language, voice, mute and End", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await within(dialog).findByText(/Listening/);
    await user.click(within(dialog).getByRole("button", { name: "اردو" }));
    expect(within(dialog).getByRole("button", { name: "اردو" })).toHaveAttribute("aria-pressed", "true");
    expect(port().listenLang).toBe("ur-PK");
    await user.click(within(dialog).getByRole("button", { name: "Male" }));
    expect(within(dialog).getByRole("button", { name: "Male" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Mute" }));
    expect(within(dialog).getByText("Microphone muted")).toBeInTheDocument();
    expect(port().listening).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "End" }));
    expect(within(dialog).queryByTestId("voice-mode")).toBeNull();
    expect(port().listening).toBe(false);
  });

  it("explains a blocked microphone and keeps typing working", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await within(dialog).findByText(/Listening/);
    act(() => port().fail("denied"));
    expect(await within(dialog).findByText("The microphone is blocked")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Your question"), "cbc price{Enter}");
    await waitFor(() => expect(within(dialog).getByRole("log")).toHaveTextContent("PKR 800"));
  });
});

describe("hands-free booking in the panel", () => {
  it("collects the booking, mirrors it in a summary card, books only after a yes, and shows the slip with QR and PDF", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await within(dialog).findByText(/Listening/);
    const log = within(dialog).getByRole("log");

    const say = async (text: string, expectText: string | RegExp) => {
      act(() => port().hear(text));
      await waitFor(() => expect(log).toHaveTextContent(expectText));
    };
    await say("I want to book an appointment with Dr Bilal", /full name/);
    await say("my name is Sara Noor", /mobile number/);
    await say("zero three one one one two three four five six seven", /visit for/);
    await say("toothache", /Which day/);
    await say("friday at 11:30", /email/);
    expect(await within(dialog).findByTestId("voice-summary")).toHaveTextContent("Sara Noor");
    await say("skip", /Shall I confirm/);

    const summary = within(dialog).getByTestId("voice-summary");
    expect(summary).toHaveTextContent("0311 123 4567");
    expect(summary).toHaveTextContent("Dr. Bilal Ansari");
    expect(summary).toHaveTextContent("Friday 13 November");
    expect(summary).toHaveTextContent("Waiting for your yes");
    expect(g.__posts).toHaveLength(0); // nothing is booked until the caller says yes

    await user.click(within(summary).getByRole("button", { name: /Yes, confirm/ }));
    const slip = await within(dialog).findByTestId("voice-slip");
    expect(g.__posts).toHaveLength(1);
    expect(within(slip).getByTestId("voice-reference")).toHaveTextContent("7K3M 9P2Q XA");
    expect(within(slip).getByRole("img", { name: /QR code for booking reference 7K3M9P2QXA/ })).toBeInTheDocument();
    expect(within(slip).getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(slip).toHaveTextContent("15 minutes early");
    expect(slip).toHaveTextContent("CNIC");
    expect(within(dialog).queryByTestId("voice-summary")).toBeNull();
  });

  it("a spoken yes after the read-back books; the typed text box works as a fallback", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await within(dialog).findByText(/Listening/);
    const log = within(dialog).getByRole("log");
    for (const [text, expected] of [
      ["book an appointment with Dr Bilal", /full name/],
      ["Sara Noor", /mobile/],
      ["03111234567", /visit for/],
      ["toothache", /Which day/],
      ["monday at 3 pm", /email/],
      ["skip", /Shall I confirm/],
    ] as const) {
      act(() => port().hear(text));
      await waitFor(() => expect(log).toHaveTextContent(expected));
    }
    expect(g.__posts).toHaveLength(0);
    act(() => port().hear("yes"));
    await within(dialog).findByTestId("voice-slip");
    expect(g.__posts).toHaveLength(1);
    expect(fakeSlots("dr-bilal-ansari").days.length).toBe(14);
    expect(bookedView(pack, { doctorSlug: "dr-bilal-ansari", startsAt: "2026-11-09T10:00:00Z" } as never).reference).toBe("7K3M9P2QXA");
  });
});
