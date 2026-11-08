// A stand-in for the browser's speech recognition and speech voices (Feature 013 end-to-end tests). A real
// microphone and speaker cannot run in CI, so the page gets a scripted Web Speech API: the test "says" words with
// `window.__hear(...)` and reads what the page "spoke" from `window.__spoken`. Nothing here is recorded or sent anywhere.
import type { Page } from "@playwright/test";

export async function installFakeWebSpeech(page: Page, options: { recognition?: boolean } = {}): Promise<void> {
  await page.addInitScript((withRecognition: boolean) => {
    const w = window as unknown as Record<string, unknown> & Window;
    const spoken: string[] = [];
    w.__spoken = spoken;
    w.__cancelled = 0;

    if (withRecognition) {
      class FakeRecognition {
        continuous = false;
        interimResults = false;
        lang = "";
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          w.__sr = this;
          w.__srLang = this.lang;
        }
        stop() {}
        abort() {}
      }
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
      const result = (isFinal: boolean, transcript: string) => ({ isFinal, 0: { transcript } });
      w.__hear = (text: string, interim = true) => {
        const rec = w.__sr as { onresult: (e: unknown) => void } | undefined;
        if (!rec) throw new Error("the page is not listening");
        if (interim) rec.onresult({ resultIndex: 0, results: [result(false, text)] });
        rec.onresult({ resultIndex: 0, results: [result(true, text)] });
      };
      w.__fail = (error: string) => {
        const rec = w.__sr as { onerror: (e: { error: string }) => void } | undefined;
        rec?.onerror({ error });
      };
    }

    class FakeUtterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onboundary: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    w.SpeechSynthesisUtterance = FakeUtterance;
    const queue: FakeUtterance[] = [];
    let busy = false;
    const next = () => {
      const u = queue.shift();
      if (!u) {
        busy = false;
        return;
      }
      busy = true;
      setTimeout(() => {
        spoken.push(u.text);
        u.onstart?.();
        u.onboundary?.();
        setTimeout(() => {
          u.onend?.();
          next();
        }, 20);
      }, 5);
    };
    const synth = {
      speak(u: FakeUtterance) {
        queue.push(u);
        if (!busy) next();
      },
      cancel() {
        w.__cancelled = (w.__cancelled as number) + 1;
        for (const u of queue.splice(0)) u.onerror?.({ error: "canceled" });
      },
      getVoices: () => [{ name: "Microsoft Neerja Online (Natural) - English (India)", lang: "en-IN", localService: false }],
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  }, options.recognition ?? true);
}

/** Everything the page has spoken so far, joined. */
export const spokenText = (page: Page): Promise<string> => page.evaluate(() => ((window as unknown as { __spoken: string[] }).__spoken ?? []).join(" "));

/** The caller says something (interim words, then the final phrase). */
export const hear = (page: Page, text: string): Promise<void> => page.evaluate((t) => (window as unknown as { __hear: (x: string) => void }).__hear(t), text);
