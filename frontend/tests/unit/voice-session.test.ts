// Feature 013: one whole voice conversation with a scripted speech port: opening lines, turn-taking, barge-in,
// echo, silence, microphone problems, the Urdu-voice note, and the safe "yes" gate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProvider } from "@/agent/registry";
import { createFakeSpeech, type FakeSpeech } from "@/voice/fakeSpeech";
import { VoiceSession, type Notice, type SessionEvents } from "@/voice/session";
import type { Turn, VoiceInfo, VoiceState } from "@/voice/types";

import { makeWorld } from "../voice/harness";

const EDGE: VoiceInfo[] = [
  { name: "Microsoft Neerja Online (Natural) - English (India)", lang: "en-IN", local: false },
  { name: "Microsoft Prabhat Online (Natural) - English (India)", lang: "en-IN", local: false },
];

function build(options: { port?: FakeSpeech; mode?: "ok" | "taken-once"; listenLang?: "en" | "ur"; skipOpening?: boolean; guide?: boolean; slowAnswerMs?: number } = {}) {
  const world = makeWorld({ mode: options.mode, guide: options.guide });
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
    onBooking: () => undefined,
    onBooked: () => (booked += 1),
    onNotice: (n) => notices.push(n),
    onLang: () => undefined,
  };
  const provider = getProvider(world.pack, "local");
  if (options.slowAnswerMs) {
    const answer = provider.answer.bind(provider);
    provider.answer = async (request) => {
      await new Promise((resolve) => setTimeout(resolve, options.slowAnswerMs));
      return answer(request);
    };
  }
  const session = new VoiceSession({ port, pack: world.pack, mode: options.guide ? "guide" : "patient", provider, deps: world.deps, events, listenLang: options.listenLang, skipOpening: options.skipOpening });
  return { session, port, world, states, turns, notices, interims, captions, get booked() { return booked; }, get boundaries() { return boundaries; } };
}

/** Everything spoken (not cancelled) since the last time the caller was heard, joined, newest last. */
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

describe("opening and listening", () => {
  it("greets once as an AI for a demo clinic, says audio is never recorded, then listens", async () => {
    const t = build();
    void t.session.start();
    await settle(t.port);
    const first = t.turns[0];
    expect(first?.from).toBe("assistant");
    expect(first?.text).toContain("Assalam o Alaikum");
    expect(first?.text).toContain("an AI");
    expect(first?.text).toContain("demo clinic");
    expect(first?.text).toContain("never record or store your audio");
    expect(t.port.listening).toBe(true);
    expect(t.port.listenLang).toBe("en-PK");
    expect(t.states).toContain("speaking");
    expect(t.states.at(-1)).toBe("listening");
    expect(t.boundaries).toBeGreaterThan(0);
    expect(t.port.spoken[0]?.voice).toContain("Neerja"); // a natural female voice by default
  });

  it("does not greet again when the caller already heard it", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    expect(t.turns).toHaveLength(0);
    expect(t.port.listening).toBe(true);
  });

  it("answers a spoken question with the same words as the text chat, speaks it, and shows captions", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?", { interim: true });
    await settle(t.port);
    expect(t.turns.map((x) => x.from)).toEqual(["you", "assistant"]);
    expect(t.turns[1]?.text).toContain("Mon–Sat, 9 AM – 9 PM");
    expect(said(t.port)).toContain("9 AM");
    // Captions follow the speech sentence by sentence.
    expect(t.captions.filter(Boolean).join(" ")).toContain("9 AM");
    expect(t.captions.at(-1)).toBeNull();
    expect(t.interims).toContain("What are your timings?");
    expect(t.states.at(-1)).toBe("listening");
  });

  it("says 'Ji, checking…' if the answer is slow, and still answers", async () => {
    const t = build({ skipOpening: true, slowAnswerMs: 1500 });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?");
    await vi.advanceTimersByTimeAsync(1100);
    expect(t.port.spoken.some((s) => s.text.startsWith("Ji, checking"))).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await settle(t.port);
    expect(said(t.port)).toContain("9 AM");
  });
});

describe("barge-in and echo", () => {
  async function speakingSession() {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.hear("What are your timings?");
    await vi.advanceTimersByTimeAsync(0);
    return t;
  }

  it("the caller talking over the assistant stops it at once and is heard", async () => {
    const t = await speakingSession();
    expect(t.port.speakingNow).not.toBeNull();
    t.port.hearInterim("no wait tell me about dental");
    expect(t.port.speakingNow).toBeNull();
    expect(t.port.spoken.some((s) => s.cancelled)).toBe(true);
    t.port.hear("tell me about dental");
    await settle(t.port);
    expect(t.turns.filter((x) => x.from === "you").at(-1)?.text).toBe("tell me about dental");
    expect(t.turns.at(-1)?.text).toMatch(/Dental/);
  });

  it("the Interrupt button stops the assistant and listens", async () => {
    const t = await speakingSession();
    t.session.interrupt();
    expect(t.port.speakingNow).toBeNull();
    expect(t.states.at(-1)).toBe("listening");
  });

  it("the assistant's own voice coming back in is NOT treated as the caller", async () => {
    const t = await speakingSession();
    const heard = t.port.speakingNow as string;
    const turnsBefore = t.turns.length;
    t.port.hearInterim(heard);
    t.port.hear(heard);
    expect(t.port.speakingNow).not.toBeNull();
    expect(t.turns).toHaveLength(turnsBefore);
  });

  it("a single stray word does not interrupt", async () => {
    const t = await speakingSession();
    t.port.hearInterim("hmm");
    expect(t.port.speakingNow).not.toBeNull();
  });
});

describe("silence", () => {
  it("prompts once, then stops listening and says to tap the microphone", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    expect(t.port.spoken.at(-1)?.text).toContain("still there");
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    expect(t.port.spoken.at(-1)?.text).toContain("stopped listening");
    await settle(t.port);
    expect(t.notices).toContain("tap_to_talk");
    expect(t.port.listening).toBe(false);
    expect(t.states.at(-1)).toBe("idle");
  });

  it("talking resets the silence count", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    await settle(t.port);
    t.port.hear("hello");
    await settle(t.port);
    await vi.advanceTimersByTimeAsync(8100);
    await settle(t.port);
    expect(t.port.listening).toBe(true);
  });
});

describe("microphone and device limits", () => {
  it("microphone refused: tells the panel, goes idle, and the text box still works", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.port.fail("denied");
    expect(t.notices).toContain("mic_denied");
    expect(t.states.at(-1)).toBe("idle");
    t.session.submitText("what are your timings");
    await settle(t.port);
    expect(t.turns.at(-1)?.text).toContain("9 AM");
    expect(said(t.port)).toContain("9 AM");
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

  it("Urdu chosen but no Urdu voice: says so once, politely, and still shows the text", async () => {
    const t = build({ skipOpening: true, listenLang: "ur" });
    void t.session.start();
    await settle(t.port);
    expect(t.port.listenLang).toBe("ur-PK");
    t.port.hear("ڈاکٹر کی فیس کتنی ہے");
    await settle(t.port);
    t.port.hear("clinic kab khulta hai");
    await settle(t.port);
    const notes = t.port.spoken.filter((s) => s.text.includes("no Urdu voice") || s.text.includes("Urdu awaaz"));
    expect(notes).toHaveLength(1);
    expect(t.notices.filter((n) => n === "no_urdu_voice")).toHaveLength(1);
    expect(t.turns.filter((x) => x.from === "assistant").length).toBeGreaterThanOrEqual(2);
  });

  it("muting stops listening; unmuting resumes", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.session.setMuted(true);
    expect(t.port.listening).toBe(false);
    expect(t.states.at(-1)).toBe("paused");
    t.session.setMuted(false);
    expect(t.port.listening).toBe(true);
  });

  it("switching to Urdu restarts listening in Urdu; female and male voices switch", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    t.session.setListenLang("ur");
    expect(t.port.listenLang).toBe("ur-PK");
    t.session.setGender("male");
    t.port.hear("what are your timings");
    await settle(t.port);
    expect(t.port.spoken.at(-1)?.voice).toContain("Prabhat");
  });
});

describe("the safe yes gate, end to end", () => {
  async function toReadBack() {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (const say of ["book an appointment with Dr Bilal", "Sara Noor", "03111234567", "toothache", "friday at 11:30", "skip"]) {
      t.port.hear(say);
      await settle(t.port);
    }
    return t;
  }

  it("a yes spoken AFTER the read-back finished books once, and the slip event fires", async () => {
    const t = await toReadBack();
    expect(t.world.submits).toHaveLength(0);
    expect(said(t.port)).toContain("Shall I confirm");
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(1);
    expect(t.booked).toBe(1);
    expect(t.port.spoken.some((s) => s.text.includes("7, K, 3, M"))).toBe(true); // the reference is spelled out
  });

  it("a yes that starts while the read-back is still being read does not book", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (const say of ["book an appointment with Dr Bilal", "Sara Noor", "03111234567", "toothache", "friday at 11:30"]) {
      t.port.hear(say);
      await settle(t.port);
    }
    t.port.hear("skip"); // the read-back now starts speaking, sentence by sentence
    await vi.advanceTimersByTimeAsync(0);
    expect(t.port.speakingNow).not.toBeNull();
    t.port.hearInterim("yes"); // one word while it speaks: ignored as a stray sound, but it overlaps the read-back
    t.port.hear("yes"); // a final "yes" that started during the read-back
    await settle(t.port);
    expect(t.world.submits).toHaveLength(0);
    expect(said(t.port)).toContain("Just to be sure");
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(1);
  });

  it("an emergency mid-booking speaks the number first and cancels the read-back", async () => {
    const t = await toReadBack();
    t.port.hear("my father has chest pain and can't breathe");
    await settle(t.port);
    expect(said(t.port)).toMatch(/1122/);
    t.port.hear("yes");
    await settle(t.port);
    expect(t.world.submits).toHaveLength(0);
  });
});

describe("rate limit", () => {
  it("asking too fast gets a calm 'please wait' instead of an answer", async () => {
    const t = build({ skipOpening: true });
    void t.session.start();
    await settle(t.port);
    for (let i = 0; i < 9; i += 1) {
      t.port.hear("what are your timings");
      await settle(t.port);
    }
    expect(said(t.port)).toMatch(/moment/);
  });
});

describe("the Clinic owner tab", () => {
  it("answers the product guide by voice and offers no booking", async () => {
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
