import { describe, expect, it } from "vitest";
import { legalContent, LEGAL_LAST_UPDATED, privacyContent, termsContent } from "@/data/legalContent";
import { getLegalContent } from "@/lib/content";
import { formatKarachiDate } from "@/lib/format";
import { countWords } from "@/lib/readingTime";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

const headings = (content: typeof privacyContent) => content.sections.map((section) => section.heading);
const allText = (content: typeof privacyContent) => stringValues(content).join(" ");

describe("legal content", () => {
  it("is served by slug", async () => {
    expect(await getLegalContent("privacy")).toBe(privacyContent);
    expect(await getLegalContent("terms")).toBe(termsContent);
    expect(Object.keys(legalContent)).toEqual(["privacy", "terms"]);
  });

  it("has a last-updated date that parses and formats as 2 Oct 2026", () => {
    for (const content of [privacyContent, termsContent]) {
      expect(content.lastUpdated).toBe(LEGAL_LAST_UPDATED);
      expect(Number.isNaN(Date.parse(content.lastUpdated))).toBe(false);
    }
    expect(formatKarachiDate(LEGAL_LAST_UPDATED)).toBe("2 Oct 2026");
  });

  it("has unique section ids that work as anchors, and a heading and text for every section", () => {
    for (const content of [privacyContent, termsContent]) {
      const ids = content.sections.map((section) => section.id);
      expect(new Set(ids).size, content.slug).toBe(ids.length);
      for (const section of content.sections) {
        expect(section.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(section.heading.trim().length).toBeGreaterThan(0);
        expect(countWords(section.blocks), section.id).toBeGreaterThan(15);
      }
    }
  });
});

describe("Privacy (FR-077)", () => {
  it("has a section for every required topic", () => {
    expect(headings(privacyContent)).toEqual(
      expect.arrayContaining([
        "What this demo collects",
        "Data a real app would collect",
        "How health data would be protected",
        "Roles and what each can see",
        "How lab reports would be accessed",
        "Cookies",
      ]),
    );
  });

  it("names the five roles, and says a patient sees only their own data", () => {
    const roles = privacyContent.sections.find((section) => section.id === "roles-and-what-they-can-see")!;
    const items = roles.blocks.flatMap((block) => (block.type === "list" ? block.items : []));
    expect(items).toHaveLength(5);
    for (const role of ["Patient", "Receptionist", "Doctor", "Lab staff", "Admin"]) {
      expect(items.some((item) => item.startsWith(`${role}:`)), role).toBe(true);
    }
    expect(allText(privacyContent)).toMatch(/a patient sees only their own data/i);
  });

  it("says reports are for the owner and authorised staff, never public links", () => {
    const text = allText(privacyContent);
    expect(text).toMatch(/person it belongs to and by authorised staff/);
    expect(text).toMatch(/never be reachable through a public link/);
  });

  it("states the demo collects no personal data and sets no tracking cookies", () => {
    const text = allText(privacyContent);
    expect(text).toMatch(/collects no personal data/);
    expect(text).toMatch(/sets no tracking cookies/);
  });

  it("says it is a portfolio demo and not legal advice", () => {
    expect(privacyContent.intro).toMatch(/portfolio demo/i);
    expect(privacyContent.intro).toMatch(/not legal advice/i);
  });
});

describe("Terms (FR-078)", () => {
  it("has a section for every required topic", () => {
    expect(headings(termsContent)).toEqual([
      "Purpose of the demo",
      "Sample content",
      "No medical advice",
      "Using the site",
      "Bookings and payments are not live",
      "Limits of responsibility",
    ]);
  });

  it("says it is a portfolio demo and not legal advice, that nothing is medical advice and that bookings are not live", () => {
    expect(termsContent.intro).toMatch(/portfolio demo/i);
    expect(termsContent.intro).toMatch(/not legal advice/i);
    const text = allText(termsContent);
    expect(text).toMatch(/nothing on this site is medical advice/i);
    expect(text).toMatch(/cannot book an appointment, pay for a test or receive a report/);
  });
});

describe("legal wording", () => {
  it("contains no claim words, brand names or compliance claims", () => {
    for (const content of [privacyContent, termsContent]) {
      const text = stringValues(content);
      expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value)), content.slug).toEqual([]);
      expect(text.filter((value) => /\b(hipaa|gdpr|compliant|compliance|secure|guarantee[sd]?)\b/i.test(value)), content.slug).toEqual([]);
    }
  });

  it("never says a protection exists today: every protection is described as what a real version would do", () => {
    const protection = privacyContent.sections.find((section) => section.id === "how-health-data-would-be-protected")!;
    expect(stringValues(protection).join(" ")).toMatch(/none of which exist in this demo/);
  });
});
