import { describe, expect, it } from "vitest";
import { buildPrivacyContent, buildTermsContent, LEGAL_LAST_UPDATED } from "@/data/legalContent";
import { formatKarachiDate } from "@/lib/format";
import { countWords } from "@/lib/readingTime";
import type { LegalContent, SiteConfig } from "@/types/content";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

const privacyContent = buildPrivacyContent(siteConfig);
const termsContent = buildTermsContent(siteConfig);
const realClinic: SiteConfig = {
  ...siteConfig,
  name: "Example Family Clinic",
  generalPhone: { display: "0300 1234567", tel: "+923001234567" },
  address: ["1 Example Street", "Lahore"],
  isSample: false,
};

const headings = (content: LegalContent) => content.sections.map((section) => section.heading);
const allText = (content: LegalContent) => stringValues(content).join(" ");
const section = (content: LegalContent, id: string) => content.sections.find((candidate) => candidate.id === id)!;

describe("legal content", () => {
  it("has a last-updated date that parses and formats as 7 Nov 2026", () => {
    for (const content of [privacyContent, termsContent]) {
      expect(content.lastUpdated).toBe(LEGAL_LAST_UPDATED);
      expect(Number.isNaN(Date.parse(content.lastUpdated))).toBe(false);
    }
    expect(formatKarachiDate(LEGAL_LAST_UPDATED)).toBe("7 Nov 2026");
  });

  it("has unique section ids that work as anchors, and a heading and text for every section", () => {
    for (const content of [privacyContent, termsContent, buildPrivacyContent(realClinic), buildTermsContent(realClinic)]) {
      const ids = content.sections.map((candidate) => candidate.id);
      expect(new Set(ids).size, content.slug).toBe(ids.length);
      for (const item of content.sections) {
        expect(item.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(item.heading.trim().length).toBeGreaterThan(0);
        expect(countWords(item.blocks), item.id).toBeGreaterThan(15);
      }
    }
  });
});

describe("template filled from clinic settings", () => {
  it("names the clinic and its phone and address from settings, never the sample clinic", () => {
    for (const content of [buildPrivacyContent(realClinic), buildTermsContent(realClinic)]) {
      const text = allText(content);
      expect(text).toContain("Example Family Clinic");
      expect(text).toContain("0300 1234567");
      expect(text).toContain("1 Example Street, Lahore");
      expect(text).not.toMatch(/Shuaib Health/);
      expect(text).not.toMatch(/portfolio demo/i);
    }
  });

  it("says on both pages that it is a template the clinic must check with a qualified legal adviser", () => {
    for (const content of [privacyContent, termsContent, buildPrivacyContent(realClinic), buildTermsContent(realClinic)]) {
      expect(content.templateNotice).toMatch(/^Template: .+ must check and adapt this page with a qualified legal adviser/);
      expect(content.intro).toMatch(/not legal advice/i);
    }
  });

  it("shows the demo-only sections only while the site runs on sample data", () => {
    expect(headings(privacyContent)).toContain("What this demo collects");
    expect(headings(termsContent)).toEqual(expect.arrayContaining(["Purpose of the demo", "Sample content", "Bookings and payments are not live"]));
    expect(headings(buildPrivacyContent(realClinic))).not.toContain("What this demo collects");
    expect(headings(buildTermsContent(realClinic))).not.toContain("Purpose of the demo");
  });

  it("falls back to the Contact page when settings hold no phone or address", () => {
    const bare = { ...realClinic, generalPhone: { display: "", tel: "" }, address: [] };
    expect(allText(buildPrivacyContent(bare))).toContain("You can reach us through the Contact page.");
    expect(allText(buildPrivacyContent(bare))).not.toMatch(/, ,/);
  });
});

describe("Privacy (FR-077)", () => {
  it("has a section for every required topic", () => {
    expect(headings(privacyContent)).toEqual(
      expect.arrayContaining([
        "Who we are",
        "What this demo collects",
        "What we collect",
        "Why we use it",
        "Roles and what each can see",
        "How lab reports are accessed",
        "Who we share it with",
        "How long we keep it",
        "How we protect it",
        "Your rights",
        "Laws by country",
        "Cookies",
      ]),
    );
  });

  it("names the five roles, and says a patient sees only their own data", () => {
    const items = section(privacyContent, "roles-and-what-they-can-see").blocks.flatMap((block) => (block.type === "list" ? block.items : []));
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

  it("says what the demo booking form collects, how long it is kept, and that nothing is sent", () => {
    const text = stringValues(section(privacyContent, "this-demo")).join(" ");
    expect(text).toMatch(/name/i);
    expect(text).toMatch(/mobile/i);
    expect(text).toMatch(/email/i);
    expect(text).toMatch(/reason/i);
    expect(text).toMatch(/7 days/);
    expect(text).toMatch(/90 days/);
    expect(text).toMatch(/No SMS or email is ever sent/);
    expect(text).toMatch(/contact form still sends nothing/);
    expect(text).toMatch(/sets no tracking cookies/);
  });

  it("lists the access, correction, deletion and objection rights and the right to complain", () => {
    const text = stringValues(section(privacyContent, "your-rights")).join(" ");
    for (const right of [/copy/, /Correct/, /Delete/, /object/, /withdraw consent/, /complain to the data protection regulator/]) expect(text).toMatch(right);
  });

  it("points to the UK, EU, UAE, Saudi, other Gulf and Pakistan rules, including PECA, PDPL-style laws and GDPR basics", () => {
    const text = stringValues(section(privacyContent, "laws-by-country")).join(" ");
    for (const law of [/UK GDPR/, /Data Protection Act 2018/, /Information Commissioner's Office/, /European Union: the GDPR/, /Federal Decree-Law No\. 45 of 2021/, /Federal Law No\. 2 of 2019/, /Personal Data Protection Law/, /SDAIA/, /Qatar, Bahrain, Oman and Kuwait/, /Prevention of Electronic Crimes Act 2016 \(PECA\)/]) {
      expect(text).toMatch(law);
    }
  });

  it("says honestly where data is hosted and that some countries expect health data to stay inside", () => {
    const text = stringValues(section(privacyContent, "who-we-share-it-with")).join(" ");
    expect(text).toMatch(/cloud servers in Singapore/);
    expect(text).toMatch(/expect health data to stay inside the country/);
  });

  it("says it is a portfolio demo and not legal advice while on sample data", () => {
    expect(privacyContent.intro).toMatch(/portfolio demo/i);
    expect(privacyContent.intro).toMatch(/not legal advice/i);
  });
});

describe("Terms (FR-078)", () => {
  it("has a section for every required topic", () => {
    expect(headings(termsContent)).toEqual([
      "Who we are",
      "Purpose of the demo",
      "Sample content",
      "Bookings and payments are not live",
      "No medical advice",
      "Booking appointments",
      "Using the site",
      "Limits of responsibility",
      "Governing law",
      "Changes to these terms",
    ]);
  });

  it("says it is a portfolio demo and not legal advice, that nothing is medical advice and that bookings are not live", () => {
    expect(termsContent.intro).toMatch(/portfolio demo/i);
    expect(termsContent.intro).toMatch(/not legal advice/i);
    const text = allText(termsContent);
    expect(text).toMatch(/nothing on this site is medical advice/i);
    expect(text).toMatch(/You can make a demo booking with a sample doctor/);
    expect(text).toMatch(/cannot pay for a test or receive a report/);
    expect(text).toMatch(/Do not enter real personal or health information into the contact or booking forms/);
    expect(text).toMatch(/In an emergency, contact your local emergency services straight away/);
  });
});

describe("legal wording", () => {
  it("contains no claim words, brand names or compliance claims", () => {
    for (const content of [privacyContent, termsContent, buildPrivacyContent(realClinic), buildTermsContent(realClinic)]) {
      const text = stringValues(content);
      expect(text.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value)), content.slug).toEqual([]);
      expect(text.filter((value) => /\b(hipaa|compliant|compliance|secure|securely|guarantee[sd]?|fully protected)\b/i.test(value)), content.slug).toEqual([]);
    }
  });

  it("names laws only in the laws-by-country section, as pointers, never as a claim", () => {
    for (const content of [privacyContent, termsContent]) {
      const outside = content.sections.filter((item) => item.id !== "laws-by-country");
      expect(stringValues([content.intro, content.templateNotice, outside]).filter((value) => /\b(gdpr|pdpl|peca|act 2018|decree)\b/i.test(value)), content.slug).toEqual([]);
    }
  });

  it("does not promise perfect safety", () => {
    expect(stringValues(section(privacyContent, "how-we-protect-it")).join(" ")).toMatch(/No system can be perfectly safe/);
  });
});
