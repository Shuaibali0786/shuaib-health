import { describe, expect, it } from "vitest";

import { groupPhone, groupReference, speakEmail, speakPhone, speakReference, splitSentences, toSpeakable } from "@/voice/chunk";

describe("voice chunking", () => {
  it("splits into short sentences and keeps 'Dr.' and times together", () => {
    const chunks = splitSentences("Dr. Ayesha Rahman sees patients at 11.30 on Monday. The fee is PKR 2,000! Shall I book?");
    expect(chunks).toEqual(["Dr. Ayesha Rahman sees patients at 11.30 on Monday.", "The fee is PKR 2,000!", "Shall I book?"]);
  });

  it("splits at Urdu full stops and question marks", () => {
    expect(splitSentences("آپ کا نام کیا ہے؟ شکریہ۔")).toEqual(["آپ کا نام کیا ہے؟", "شکریہ۔"]);
  });

  it("breaks one very long sentence at commas, never above the limit", () => {
    const long = Array.from({ length: 30 }, (_, i) => `item number ${i}`).join(", ") + ".";
    const chunks = splitSentences(long, 120);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("item number 29");
  });

  it("removes links, markdown and emoji before speaking", () => {
    expect(toSpeakable("See **the page** https://example.test/x now 🙂")).toBe("See the page now");
  });

  it("reads a phone number digit by digit in groups", () => {
    expect(groupPhone("+923001234567")).toBe("0300 123 4567");
    expect(speakPhone("+923001234567")).toBe("zero three zero zero, one two three, four five six seven");
  });

  it("reads a reference character by character in groups of four", () => {
    expect(groupReference("7K3M9P2QXA")).toBe("7K3M 9P2Q XA");
    expect(speakReference("7K3M9P2QXA")).toBe("7, K, 3, M. 9, P, 2, Q. X, A");
    // A hyphen or lower case in the reference is ignored.
    expect(groupReference("7k3m9-p2qxa")).toBe("7K3M 9P2Q XA");
    expect(speakReference("7K3M9-P2QXA")).toBe("7, K, 3, M. 9, P, 2, Q. X, A");
  });

  it("reads an email the way people say it", () => {
    expect(speakEmail("ali.raza_1@gmail.com")).toBe("ali dot raza underscore 1 at gmail dot com");
  });
});
