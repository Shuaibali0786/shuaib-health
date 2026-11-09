// Feature 013: the voice receptionist inside the chat widget (jsdom, scripted speech, fake booking route).
import { act, configure, render, screen, waitFor, within } from "@testing-library/react";
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

// Voice mode waits for the patient to finish (about 1.3 s) and breathes before listening again.
configure({ asyncUtilTimeout: 6000 });
vi.setConfig({ testTimeout: 30000 });

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
  // The mic inside the "Ask us" button opens voice mode straight away.
  await user.click(screen.getByRole("button", { name: "Talk by voice, in English or Urdu" }));
  return screen.findByRole("dialog", { name: /Ask Shuaib Health/ });
}

/** The status line under the orb ("Listening...", "Thinking...", "Speaking..."). */
const statusOf = (dialog: HTMLElement) => within(dialog).getAllByRole("status").find((el) => /Listening|Thinking|Speaking|Tap the mic/.test(el.textContent ?? "")) as HTMLElement;

describe("flag off (the default)", () => {
  it("shows no mic on the button, no Mic and no Voice mode button", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} />);
    expect(screen.queryByRole("button", { name: /Talk by voice/ })).toBeNull();
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

  it("ONE 'Ask us' button with the mic inside it (no separate 'Talk to us' bubble); the chat shows Mic and Voice mode beside Send", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    const mic = screen.getByRole("button", { name: "Talk by voice, in English or Urdu" });
    const ask = screen.getByRole("button", { name: "Ask us" });
    expect(mic.parentElement).toBe(ask.parentElement);
    expect(screen.queryByRole("button", { name: /Talk to us/ })).toBeNull();
    await user.click(ask);
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

  it("Roman Urdu by typing: CBC test -> explanation -> haan -> one item at a time -> card with the TEST and its price -> Confirm -> Open my slip", async () => {
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
    await type("nahi", "Confirm dabaiye");
    const card = within(dialog).getByTestId("voice-summary");
    // The card shows every detail, and the TEST with its price (not the doctor's visit fee).
    expect(card).toHaveTextContent("Complete Blood Count (CBC) - PKR 800 (sample)");
    expect(card).toHaveTextContent("Dr. Zainab Memon");
    expect(card).toHaveTextContent("Monday 9 November");
    expect(card).toHaveTextContent("Ayesha Khan");
    expect(card).toHaveTextContent("0300 551 2345");
    expect(card).not.toHaveTextContent("PKR 1,500");
    expect(card).not.toHaveTextContent("Fee");
    expect(g.__posts).toHaveLength(0);
    // Tapping Confirm is the patient's own yes (in their language).
    await user.click(within(card).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(log).toHaveTextContent("Slip download karke mobile mein save karein aur clinic aate waqt saath laayein."));
    expect(g.__posts).toHaveLength(1);
    const slip = within(dialog).getByTestId("voice-slip");
    expect(within(slip).getByTestId("voice-booked-test")).toHaveTextContent("Complete Blood Count (CBC) - PKR 800 (sample)");
    const open = within(slip).getByRole("link", { name: /^Open my slip/ });
    expect(open).toHaveAttribute("href", "/book-appointment/confirmed/7K3M9P2QXA?test=complete-blood-count");
    expect(open).toHaveAttribute("target", "_blank");
  }, 30000);

  it("English by typing: Change fixes only the chosen item and shows the card again", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const log = within(dialog).getByRole("log");
    const type = async (text: string, expected: string | RegExp) => {
      await user.type(within(dialog).getByLabelText("Your question"), `${text}{Enter}`);
      await waitFor(() => expect(log).toHaveTextContent(expected));
    };
    await type("I want to book an appointment with Dr Bilal", "Which day");
    await type("friday at 11:30", "full name");
    await type("Sara Noor", "mobile");
    await type("03111234567", "email");
    await type("skip", "Please check the card, then say yes or tap Confirm.");
    let card = within(dialog).getByTestId("voice-summary");
    expect(card).toHaveTextContent("0311 123 4567");
    expect(card).toHaveTextContent("Fee");
    // Change -> Mobile: only the number is asked again, then the card comes back with the new number.
    await user.click(within(card).getByRole("button", { name: "Change" }));
    await user.click(within(card).getByRole("button", { name: "Mobile" }));
    await waitFor(() => expect(log).toHaveTextContent("What is your mobile number?"));
    expect(log.textContent).not.toMatch(/full name[sS]*full name/);
    await type("03211234567", "Please check, then say yes");
    card = within(dialog).getByTestId("voice-summary");
    expect(card).toHaveTextContent("0321 123 4567");
    expect(card).toHaveTextContent("Sara Noor");
    expect(card).toHaveTextContent("Friday 13 November");
    expect(g.__posts).toHaveLength(0);
    await user.click(within(card).getByRole("button", { name: "Confirm" }));
    const slip = await within(dialog).findByTestId("voice-slip");
    expect(g.__posts).toHaveLength(1);
    expect(within(slip).getByRole("link", { name: /^Open my slip/ })).toHaveAttribute("href", "/book-appointment/confirmed/7K3M9P2QXA");
    expect(within(slip).queryByTestId("voice-booked-test")).toBeNull();
  }, 30000);
});

describe("the owner's real messages, typed", () => {
  it("'boking karo blod ki test karnekiay' starts the blood test booking with tappable days; tapping one moves on", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const log = within(dialog).getByRole("log");
    await user.type(within(dialog).getByLabelText("Your question"), "boking karo blod ki test karnekiay{Enter}");
    await waitFor(() => expect(log).toHaveTextContent("Kaun sa din"));
    expect(log).toHaveTextContent("Pathology Lab");
    expect(log).not.toHaveTextContent("kis doctor");
    const choices = within(dialog).getByTestId("assistant-options");
    const firstDay = within(choices).getAllByRole("button")[0] as HTMLElement;
    await user.click(firstDay);
    await waitFor(() => expect(log).toHaveTextContent("Kaun sa waqt"));
    const times = within(within(dialog).getByTestId("assistant-options")).getAllByRole("button");
    expect(times.length).toBeGreaterThanOrEqual(2);
    await user.click(times[0] as HTMLElement);
    await waitFor(() => expect(log).toHaveTextContent("poora naam"));
    expect(within(dialog).queryByTestId("assistant-options")).toBeNull();
  }, 30000);

  it("'mujhy elaj karwana hia' asks what the problem is, never 'I don't know'", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const log = within(dialog).getByRole("log");
    await user.type(within(dialog).getByLabelText("Your question"), "mujhy elaj karwana hia{Enter}");
    await waitFor(() => expect(log).toHaveTextContent("Aap ko kya takleef hai"));
    expect(log).not.toHaveTextContent("nahi maloom");
    await user.click(within(within(dialog).getByTestId("assistant-options")).getByRole("button", { name: "Daant" }));
    await waitFor(() => expect(log).toHaveTextContent("Dental department"));
  }, 30000);
});

describe("the mobile number field (owner test 2026-11-09)", () => {
  it("appears when the number is asked, checks the number, and 'Save number' sends it", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={pack} voice />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const log = within(dialog).getByRole("log");
    const type = async (text: string, expected: string | RegExp) => {
      await user.type(within(dialog).getByLabelText("Your question"), `${text}{Enter}`);
      await waitFor(() => expect(log).toHaveTextContent(expected));
    };
    await type("Dr Bilal se appointment chahiye", "Kaun sa din");
    expect(within(dialog).queryByTestId("phone-field")).toBeNull();
    await type("jumma ko", "Kaun sa waqt");
    await type("11:30", "poora naam");
    await type("mera naam Ali Raza hai", "Aap number bol sakte hain ya neeche likh bhi sakte hain.");
    const field = within(dialog).getByTestId("phone-field");
    const box = within(field).getByLabelText("Mobile number likhein");
    expect(box).toHaveAttribute("type", "tel");
    expect(box).toHaveAttribute("inputmode", "numeric");
    // A wrong number is caught here and nothing is sent.
    await user.type(box, "0032452");
    await user.click(within(field).getByRole("button", { name: "Save number" }));
    expect(within(field).getByRole("alert")).toHaveTextContent("11 digits");
    await user.clear(box);
    await user.type(box, "0324 5266535");
    await user.click(within(field).getByRole("button", { name: "Save number" }));
    await waitFor(() => expect(log).toHaveTextContent("email"));
    expect(log).toHaveTextContent("03245266535");
    expect(within(dialog).queryByTestId("phone-field")).toBeNull();
  }, 30000);
});

describe("voice mode", () => {
  it("shows ONE welcome: the spoken welcome replaces the written one", async () => {
    const user = userEvent.setup();
    const dialog = await openVoiceByBubble(user);
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
    const log = within(dialog).getByRole("log");
    expect(log.textContent?.match(/Welcome to Shuaib Health/g)?.length).toBe(1);
    expect(log).not.toHaveTextContent("Hello! Welcome");
  });

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
      ["skip", /tap Confirm/],
    ] as const) {
      // The mic opens only after the assistant has finished speaking.
      await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."));
      act(() => port().hear(text));
      await waitFor(() => expect(log).toHaveTextContent(expected));
    }
    const summary = within(dialog).getByTestId("voice-summary");
    expect(summary).toHaveTextContent("0311 123 4567");
    expect(summary).toHaveTextContent("Please check");
    expect(g.__posts).toHaveLength(0);
    // The read-back is spoken sentence by sentence: say yes once it has finished.
    await waitFor(() => expect(statusOf(dialog)).toHaveTextContent("Listening..."), { timeout: 8000 });
    act(() => port().hear("yes"));
    const slip = await within(dialog).findByTestId("voice-slip");
    expect(g.__posts).toHaveLength(1);
    expect(within(slip).getByTestId("voice-reference")).toHaveTextContent("7K3M 9P2Q XA");
    expect(within(slip).getByRole("link", { name: /^Open my slip/ })).toHaveAttribute("href", "/book-appointment/confirmed/7K3M9P2QXA");
    expect(log).toHaveTextContent("Tap Open my slip, download the slip, save it on your phone");
  }, 30000);
});
