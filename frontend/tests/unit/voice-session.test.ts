// Feature 013: one whole voice conversation with a scripted speech port: the welcome, one voice for the whole call,
// automatic language, turn-taking, barge-in, echo, the single mic button, silence, microphone and Edge errors, and the
// safe "yes" gate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProvider } from "@/agent/registry";
import { createFakeSpeech, type FakeSpeech } from "@/voice/fakeSpeech";
import { Conversation } from "@/voice/router";
import { VoiceSession, type Notice, type SessionEvents } from "@/voice/session";
import type { Turn, VoiceInfo, VoiceLang, VoiceState } from "@/voice/types";

import { makeWorld } from "../voice/harness";

const EDGE: VoiceInfo[] = [
  { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US", local: false },
  { name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US", local: false },
  { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US", local: false },
  { name: "Microsoft Neerja Online (Natural) - English (India)", lang: "en-IN", local: false },
  { name: "Microsoft Uzma Online (Natural) - Urdu (Pakistan)", lang: "ur-PK", local: false },
  { name: "Microsoft Asad Online (Natural) - Urdu (Pakistan)", lang: "ur-PK", local: false },
];

function build(options: { port?: FakeSpeech; skipOpening?: boolean; guide?: boolean; slowAnswerMs?: number; welcomeLang?: VoiceLang } = {}) {
  const world = makeWorld({ guide: options.guide });
  const port = options.port ?? createFakeSpeech({ voices: EDGE });
  const states: VoiceState[] = [];
  const turns: Turn[] = [];
  const notices: Notice[] = [];
  const interims: string[] = [];
  const captions: Array<string | null> = [];
  let booked = 0;
  let boundaries = 0;
  const events: SessionEvents = {
    onState: (s) => states.push(s),
    onInterim: (t) => interims.push(t),
    onTurn: (t) => turns.push(t),
    onSpeaking: (s) => captions.push(s),
    onBoundary: () => (boundaries += 1),
    onResult: (r) => {
      if (r.booked) booked += 1;
    },
    onNotice: (n) => notices.push(n),
  };
  const provider = getProvider(world.pack, "local");
  if (options.slowAnswerMs) {
    const answer = provider.answer.bind(provider);
    provider.answer = async (request) => {
      await new Promise((resolve) => setTimeout(resolve, options.slowAnswerMs));
      return answer(request);
    };
  }
  const conversation = new Conversation({ pack: world.pack, mode: options.guide ? "guide" : "patient", provider, deps: world.deps });
  const session = new VoiceSession({ port, conversation, events, skipOpening: options.skipOpening, welcomeLang: options.welcomeLang, pauseMs: 0 });
  return { session, port, world, conversation, states, turns, notices, interims, captions, get booked() { return booked; }, get boundaries() { return boundaries; } };
}

/** Everything spoken (not cancelled), joined, newest last. */
function said(port: FakeSpeech): string {
  return port.spoken.filter((x) => !x.cancelled).map((x) => x.text).join(" ");
}

/** Lets the session finish every sentence it has queued, then settle. */
async function settle(port: FakeSpeech, rounds = 12) {
  for (let i = 0; i < rounds; i += 1) {
    await vi.advanceTimersByTimeAsync(0);
    port.finishAll();
  }
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the welcome", () => {
  it("English: short and warm, in one warm female voice, then it listens by itself", async () => {
    const t = build();
    void t.session.start();
    await settle(t.port);
    expect(t.turns[0]?.text).toBe("Welcome to Shuaib Health! I'm your AI assistant. How can I help you today?");
    expect(said(t.port)).not.toMatch(/record/i); // "audio is never recorded" is small text, not spoken
    expect(t.port.spoken[0]?.voice).toContain("Jenny");
    expect(t.port.listening).toBe(true);
    expect(t.port.listenLang).toBe("en-IN");
    expect(t.states.at(-1)).toBe("listening");
    expect(t.boundaries).toBeGreaterThan(0);
  });

  it("Roman Urdu: the Urdu welcome in the Urdu voice, with the words in Urdu script for that voice", async () => {
    const t = build({ welcomeLang: "roman" });
    void t.session.start();
    await settle(t.port);
    expect(t.turns[0]?.text).toBe("Assalam o Alaikum! Shuaib Health mein khush aamdeed. Main aap ki AI assistant hoon, bataiye kya madad karoon?");
    expect(t.port.spoken[0]?.voice).toContain("Uzma");
    expect(t.port.spoken[0]?.text).toContain("السلام علیکم");
  });

  it("does not welcome again when the caller already heard it, and still listens", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    expect(t.turns).toHaveLength(0);
    expect(t.port.listening).toBe(true);
  });
});

describe("one voice, automatic language", () => {
  it("English in, English out; Roman Urdu in, Roman Urdu out; the same single female voice throughout", async () => {
    const t = build();
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toContain("We are open");
    t.port.hear("Lab kab khulti hai?");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toContain("khuli hai");
    expect(t.turns.at(-1)?.text).not.toContain("We are open");
    const voices = new Set(t.port.spoken.map((s) => s.voice));
    expect(voices.size).toBe(1);
    expect([...voices][0]).toContain("Jenny");
    expect(t.port.spokenRates.every((r) => r === 0.95)).toBe(true);
  });

  it("shows captions sentence by sentence and clears them after speaking", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?", { interim: true });
    await settle(t.port);
    expect(t.captions.filter(Boolean).join(" ")).toContain("9 AM");
    expect(t.captions.at(-1)).toBeNull();
    expect(t.interims).toContain("What are your timings?");
  });

  it("says a short 'one moment, checking' if the answer is slow, and still answers", async () => {
    const t = build({ skipOpening: true, slowAnswerMs: 1500 });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?");
    await vi.advanceTimersByTimeAsync(1100);
    expect(t.port.spoken.some((s) => s.text.startsWith("One moment, checking"))).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await settle(t.port);
    expect(said(t.port)).toContain("9 AM");
  });
});

describe("barge-in, echo and the one mic button", () => {
  async function speakingSession() {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?");
    await vi.advanceTimersByTimeAsync(0);
    return t;
  }

  it("the patient starting to talk stops the assistant at once and is heard", async () => {
    const t = await speakingSession();
    expect(t.port.speakingNow).not.toBeNull();
    t.port.hearInterim("no wait tell me about dental");
    expect(t.port.speakingNow).toBeNull();
    t.port.hear("tell me about dental");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toMatch(/Dental/);
  });

  it("its own voice coming back in, or a single stray word, does not interrupt", async () => {
    const t = await speakingSession();
    const heard = t.port.speakingNow as string;
    const before = t.turns.length;
    t.port.hearInterim(heard);
    t.port.hear(heard);
    t.port.hearInterim("hmm");
    expect(t.port.speakingNow).not.toBeNull();
    expect(t.turns).toHaveLength(before);
  });

  it("the mic button: a tap while it speaks cuts in; a tap while listening stops; another tap listens again", async () => {
    const t = await speakingSession();
    t.session.toggleMic();
    expect(t.port.speakingNow).toBeNull();
    expect(t.states.at(-1)).toBe("listening");
    t.session.toggleMic();
    expect(t.port.listening).toBe(false);
    expect(t.states.at(-1)).toBe("idle");
    t.session.toggleMic();
    expect(t.port.listening).toBe(true);
    expect(t.states.at(-1)).toBe("listening");
  });
});

describe("silence", () => {
  it("prompts once, then stops listening and says to tap the mic", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    expect(said(t.port)).toContain("still there");
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    await settle(t.port);
    expect(said(t.port)).toContain("stopped listening");
    expect(t.notices).toContain("tap_to_talk");
    expect(t.port.listening).toBe(false);
    expect(t.states.at(-1)).toBe("idle");
  });
});

describe("microphone and browser problems", () => {
  it("microphone refused: tells the panel, stops, and the text box still works", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.fail("denied");
    expect(t.notices).toContain("mic_denied");
    expect(t.states.at(-1)).toBe("idle");
    t.session.submitText("what are your timings");
    await settle(t.port);
    expect(said(t.port)).toContain("9 AM");
  });

  it("Edge's 'speech service not reachable' (network): a clear notice, and it stops trying", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.fail("network");
    expect(t.notices).toContain("network");
    expect(t.port.listening).toBe(false);
    expect(t.states.at(-1)).toBe("idle");
    t.session.resume();
    expect(t.port.listening).toBe(true);
  });

  it("no speech recognition: speaks only, and says so", async () => {
    const t = build({ port: createFakeSpeech({ canListen: false, voices: EDGE }), skipOpening: true });
    void t.session.start();
    await settle(t.port);
    expect(t.notices).toContain("listen_unsupported");
    t.session.submitText("what are your timings");
    await settle(t.port);
    expect(said(t.port)).toContain("9 AM");
  });
});

describe("the safe yes gate, end to end", () => {
  const steps = ["book an appointment with Dr Bilal", "friday at 11:30", "Sara Noor", "03111234567"];

  it("a yes spoken AFTER the read-back finished books once, and spells the reference", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (const s of [...steps, "skip"]) {
      t.port.hear(s);
      await settle(t.port);
    }
    expect(said(t.port)).toContain("Shall I confirm");
    expect(t.world.submits).toHaveLength(0);
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(1);
    expect(t.booked).toBe(1);
    expect(said(t.port)).toContain("7, K, 3, M");
  });

  it("a yes that starts while the read-back is still being read does not book", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (const s of steps) {
      t.port.hear(s);
      await settle(t.port);
    }
    t.port.hear("skip");
    await vi.advanceTimersByTimeAsync(0);
    expect(t.port.speakingNow).not.toBeNull();
    t.port.hearInterim("yes");
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(0);
    expect(said(t.port)).toContain("Just to be sure");
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(1);
  });

  it("an emergency mid-booking speaks the number first and cancels the read-back", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (const s of [...steps, "skip"]) {
      t.port.hear(s);
      await settle(t.port);
    }
    t.port.hear("my father has chest pain and can't breathe");
    await settle(t.port);
    expect(said(t.port)).toMatch(/1122/);
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(0);
  });

  it("typed turns and spoken turns are one conversation (the booking continues from the text box)", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("book an appointment with Dr Bilal");
    await settle(t.port);
    t.session.submitText("friday at 11:30");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toContain("full name");
    expect(t.conversation.ctx.booking?.draft.time).toBe("11:30");
  });
});

describe("limits and tabs", () => {
  it("asking too fast gets a calm 'please wait' instead of an answer", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (let i = 0; i < 25; i += 1) {
      t.port.hear("what are your timings");
      await settle(t.port);
    }
    expect(said(t.port)).toMatch(/moment/);
  });

  it("the Clinic owner tab answers the product guide by voice and offers no booking", async () => {
    const t = build({ skipOpening: true, guide: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("Does it work for a dental clinic?");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toMatch(/dental/i);
    t.port.hear("book an appointment");
    await settle(t.port);
    expect(t.session.booking).toBeNull();
  });
});
