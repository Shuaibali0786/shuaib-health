// Feature 013: the voice receptionist inside the chat widget (jsdom, scripted speech, fake booking route).
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantLauncher } from "@/components/agent/AssistantLauncher";
import type { FakeSpeech } from "@/voice/fakeSpeech";

import { NOW, packFor } from "../voice/harness";

const g = globalThis as unknown as { __fakeSpeech?: FakeSpeech; __posts?: unknown[] };
const port = () => g.__fakeSpeech as FakeSpeech;

vi.mock("@/voice/browserSpeech", async () => {
  const { createFakeSpeech } = await import("@/voice/fakeSpeech");
  const fake = createFakeSpeech({
    autoFinish: true,
    voices: [
      { name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US", local: false },
      { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US", local: false },
      { name: "Microsoft Uzma Online (Natural) - Urdu (Pakistan)", lang: "ur-PK", local: false },
    ],
  });
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
    fetchSpeechToken: async () => {
      throw new Error("not in tests");
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
const FOOTER = "Portfolio demo — not a real clinic, not medical advice. This is a demo: please use sample details only, never your real personal or medical information.";

async function openVoiceByBubble(user: ReturnType<typeof userEvent.setup>) {
  render(<AssistantLauncher pack={pack} voice />);
  const bubble = await screen.findByRole("button", { name: /Talk to us/ }, { timeout: 4000 });
  await user.click(bubble);
  return screen.findByRole("dialog", { name: /Ask Shuaib Health/ });
}

/** The status line under the orb ("Listening...", "Thinking...", "Speaking..."). */
const statusOf = (dialog: HTMLElement) => within(dialog).getAllByRole("status").find((el) => /Listening|Thinking|Speaking|Tap the mic/.test(el.textContent ?? "")) as HTMLElement;

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

describe("the chat", () => {
  it("says the same clear footer in the text chat and in voice mode", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(FOOTER)).toBeInTheDocument();
    await user.click(await within(dialog).findByRole("button", { name: /Start voice mode/ }));
    await within(dialog).findByTestId("voice-mode");
    expect(within(dialog).getByText(FOOTER)).toBeInTheDocument();
  });

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
  });

  it("Mic dictates into the box for editing and sends nothing", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /Dictate your question/ }));
    act(() => port().hear("what are your timings", { interim: true }));
    expect(within(dialog).getByLabelText("Your question")).toHaveValue("what are your timings");
    expect(within(dialog).getByRole("log").textContent).not.toMatch(/Mon–Sat/);
  });

  it("books by typing too: 'mujhe CBC test karwana hai' -> explanation -> haan -> one item at a time -> ji haan -> slip link", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const log = within(dialog).getByRole("log");
    const type = async (text: string, expected: string | RegExp) => {
      await user.type(within(dialog).getByLabelText("Your question"), `${text}{Enter}`);
      await waitFor(() => expect(log).toHaveTextContent(expected));
    };
    await type("mujhe CBC test karwana hai", "Kya main aap ki booking kar doon?");
    expect(log).toHaveTextContent("Pathology Lab");
    await type("haan", "Kaun sa din");
    await type("kal", "Kaun sa waqt");
    await type("saade gyarah", "poora naam");
    await type("mera naam Ayesha Khan hai", "mobile number");
    await type("03005512345", "email");
    expect(within(dialog).getByTestId("voice-summary")).toHaveTextContent("Ayesha Khan");
    await type("nahi", "confirm kar doon");
    expect(g.__posts).toHaveLength(0);
    await type("ji haan", "Is link ko tap karein, slip download karein, aur clinic aate waqt saath laayein.");
    expect(g.__posts).toHaveLength(1);
    const slip = within(dialog).getByTestId("voice-slip");
    const link = within(slip).getByRole("link", { name: /Slip dekhein \/ download karein/ });
    expect(link).toHaveAttribute("href", "/book-appointment/confirmed/7K3M9P2QXA");
    expect(link).toHaveAttribute("target", "_blank");
  }, 30000);
});

describe("voice mode", () => {
  it("opens from the bubble: orb, status, the welcome, and only a mic button and End", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    expect(await within(dialog).findByTestId("voice-mode")).toBeInTheDocument();
    expect(within(dialog).getByTestId("voice-orb")).toBeInTheDocument();
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    expect(within(dialog).getByRole("log")).toHaveTextContent("Welcome to Shuaib Health! I'm your AI assistant. How can I help you today?");
    expect(within(dialog).getByText(/audio is never recorded/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Stop listening" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "End" })).toBeInTheDocument();
    for (const gone of ["Mute", "Interrupt", "EN", "اردو", "Female", "Male", "Hear a sample"]) {
      expect(within(dialog).queryByRole("button", { name: gone, exact: true } as never)).toBeNull();
    }
    expect(within(dialog).queryByLabelText("Voice")).toBeNull();
    act(() => port().hear("What are your timings?", { interim: true }));
    await waitFor(() => expect(within(dialog).getByRole("log")).toHaveTextContent("Mon–Sat, 9 AM – 9 PM"));
    expect(new Set(port().spoken.map((s) => s.voice)).size).toBe(1);
  });

  it("the mic button stops and starts listening; End leaves voice mode", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    await user.click(within(dialog).getByRole("button", { name: "Stop listening" }));
    expect(statusOf(dialog)).toHaveTextContent("Tap the mic to talk");
    expect(port().listening).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Tap to talk" }));
    expect(statusOf(dialog)).toHaveTextContent("Listening...");
    await user.click(within(dialog).getByRole("button", { name: "End" }));
    expect(within(dialog).queryByTestId("voice-mode")).toBeNull();
    expect(port().listening).toBe(false);
  });

  it("explains a blocked microphone with Edge and Windows steps, and typing still works", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    act(() => port().fail("denied"));
    expect(await within(dialog).findByText("The microphone is blocked")).toBeInTheDocument();
    expect(within(dialog).getByText(/Privacy & security, then Microphone/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Your question"), "cbc price{Enter}");
    await waitFor(() => expect(within(dialog).getByRole("log")).toHaveTextContent("PKR 800"));
  });

  it("Edge's listening service error says to use Chrome or type", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    act(() => port().fail("network"));
    expect(await within(dialog).findByText("Voice listening works most reliably in the Chrome browser")).toBeInTheDocument();
    expect(within(dialog).getByText(/You can also type below/)).toBeInTheDocument();
  });

  it("books by voice: one item at a time, a summary card, a spoken yes after the read-back, and the slip link", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    const log = within(dialog).getByRole("log");
    for (const [text, expected] of [
      ["I want to book an appointment with Dr Bilal", /Which day/],
      ["monday at 3 pm", /full name/],
      ["my name is Sara Noor", /mobile number/],
      ["zero three one one one two three four five six seven", /email/],
      ["skip", /Shall I confirm/],
    ] as const) {
      act(() => port().hear(text));
      await waitFor(() => expect(log).toHaveTextContent(expected));
    }
    const summary = within(dialog).getByTestId("voice-summary");
    expect(summary).toHaveTextContent("0311 123 4567");
    expect(summary).toHaveTextContent("Waiting for your yes");
    expect(g.__posts).toHaveLength(0);
    // The read-back is spoken sentence by sentence: say yes once it has finished.
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."), { timeout: 8000 });
    act(() => port().hear("yes"));
    const slip = await within(dialog).findByTestId("voice-slip");
    expect(g.__posts).toHaveLength(1);
    expect(within(slip).getByTestId("voice-reference")).toHaveTextContent("7K3M 9P2Q XA");
    expect(within(slip).getByRole("link", { name: /View \/ Download slip/ })).toHaveAttribute("href", "/book-appointment/confirmed/7K3M9P2QXA");
    expect(log).toHaveTextContent("Tap the link below to view and download your slip");
  }, 30000);
});
