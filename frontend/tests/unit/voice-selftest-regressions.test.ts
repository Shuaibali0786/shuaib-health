// Feature 013: bugs found by the browser self-test as a patient (2026-11-08 night), kept as regression tests.
import { describe, expect, it } from "vitest";

import { replyLanguage } from "@/voice/language";
import { isEcho } from "@/voice/session";

import { makeWorld } from "../voice/harness";

describe("self-test regressions", () => {
  it("#4: an email with a doctor's first name in it ('ayesha at gmail dot com') never changes the doctor", async () => {
    const w = makeWorld({ lang: "roman" });
    for (const t of ["Daant ki safai karwani hai", "kar do", "monday", "11:30", "Ayesha Siddiqui", "0333 4567890"]) await w.say(t);
    expect(w.ctx.booking?.asking).toBe("email");
    const out = await w.say("ayesha at gmail dot com");
    expect(w.ctx.booking?.draft.doctorSlug).toBe("dr-bilal-ansari");
    expect(w.ctx.booking?.draft.email).toBe("ayesha@gmail.com");
    expect(out.text).toContain("Confirm");
  });

  it("#13: 'rehne do' is answered in Roman Urdu", async () => {
    expect(replyLanguage("rehne do rehne do", "en")).toBe("roman");
    const w = makeWorld();
    for (const t of ["mujhe khansi hai", "ji"]) await w.say(t);
    const out = await w.say("rehne do");
    expect(out.intent).toBe("booking_abandoned");
    expect(out.text).toContain("Kuch book nahi hua");
  });

  it("#16: a long echo that runs across two of its own sentences, heard in Urdu letters, is caught", () => {
    const recent = ["Maaf kijiye, main theek se sun nahi saki.", "Maaf kijiye, main theek se sun nahi saki.", "Dobara bataiye, aap Urdu mein bhi bol sakte hain.", "Dobara bataiye, aap Urdu mein bhi bol sakte hain."];
    expect(isEcho("معاف کیجیے میں ٹھیک سے سن نہیں سکی دوبارہ بتائیے آپ اردو میں بھی بول سکتے ہیں", recent)).toBe(true);
    // ...while a patient's real answer is not.
    expect(isEcho("mujhe bukhar hai", recent)).toBe(false);
    expect(isEcho("haan spelling theek hai", ["Maine aap ka naam Shuaib Ali likha hai.", "Spelling theek hai?"])).toBe(false);
  });
});
