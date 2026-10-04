import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeBar } from "@/components/layout/NoticeBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CREDIT, DEMO_NOTICE } from "@/lib/honesty";
import clinicJson from "../fixtures/api/clinic.json";
import { clinicState } from "./helpers/catalog-api-mock";
import { aboutContent } from "@/data/aboutContent";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { faqGroups } from "@/data/faq";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { healthTips } from "@/data/healthTips";
import { buildFacts, buildHeroFacts, quickActions, whyPoints } from "@/data/homeContent";
import { labTestCategories, labTests } from "../fixtures/catalog/labTests";
import { privacyContent, termsContent } from "@/data/legalContent";
import { siteConfig } from "../fixtures/catalog/siteConfig";
import { BANNED_CLAIMS, BRAND_WORDS, stringValues } from "./helpers/forbidden";

/**
 * Constitution I (honesty) and V (no backend dependency), as automatic checks.
 *
 * Scans code with comments removed (comments legitimately say "no ratings, no awards"), and uses
 * whole-word matches so "reviewing a folder" or the CSS class "leading-none" do not trip it.
 */

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

beforeEach(() => {
  clinicState.mode = "ok";
});

// npm run test always runs from frontend/.
const SRC = join(process.cwd(), "src");

function filesUnder(dir: string, extensions: string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path, extensions);
    return extensions.some((extension) => entry.endsWith(extension)) ? [path] : [];
  });
}

/** Source without // and /* *\/ comments. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Import statements are code, not visitor-facing text (for example "next/font/google"). */
function withoutImports(source: string): string {
  return source
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "")
    .replace(/^import\s+["'][^"']+["'];?$/gm, "");
}

const codeFiles = filesUnder(SRC, [".ts", ".tsx"]).map((path) => ({
  path: path.replace(process.cwd(), "").split("\\").join("/"),
  code: withoutImports(withoutComments(readFileSync(path, "utf8"))),
}));

describe("no fabricated claims", () => {
  it("none of the sample data contains a claim word", () => {
    const text = stringValues([departments, doctors, healthTips, labTests, labTestCategories, healthPackages, aboutContent, faqGroups, privacyContent, termsContent, buildHeroFacts(siteConfig.openingHours), quickActions, buildFacts(departments.length, siteConfig.openingHours), buildFacts(undefined, siteConfig.openingHours), whyPoints, siteConfig]);
    const offenders = text.filter((value) => BANNED_CLAIMS.test(value));
    expect(offenders).toEqual([]);
  });

  it("none of the components or pages contains a claim word", () => {
    const offenders = codeFiles
      .filter((file) => file.path.includes("/components/") || file.path.includes("/app/"))
      .filter((file) => BANNED_CLAIMS.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("the facts band and hero cards state no numbers except the department count and opening hours", () => {
    const numbers = [...buildFacts(departments.length, siteConfig.openingHours), ...buildHeroFacts(siteConfig.openingHours)].flatMap((fact) => ("value" in fact ? [fact.value, fact.label] : [fact.label]));
    const withDigits = numbers.filter((text) => /\d/.test(text));
    // "7" (departments) and the hours ("9 AM – 9 PM PKT") are the only digits allowed.
    expect(withDigits.sort()).toEqual(["7", "9 AM – 9 PM PKT", "Open Mon–Sat, 9 AM – 9 PM PKT"].sort());
  });
});

describe("no third-party brands", () => {
  it("the sample data, components, pages and image file names contain none", () => {
    const text = stringValues([departments, doctors, healthTips, labTests, healthPackages, aboutContent, privacyContent, termsContent, siteConfig]);
    expect(text.filter((value) => BRAND_WORDS.test(value))).toEqual([]);
    const offenders = codeFiles.filter((file) => BRAND_WORDS.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
    const imageNames = filesUnder(join(process.cwd(), "public", "images"), [".jpg", ".png", ".svg", ".webp"]);
    expect(imageNames.filter((name) => BRAND_WORDS.test(name))).toEqual([]);
  });
});

describe("no backend dependency (constitution V)", () => {
  it("src contains no fetch() call except the catalog API client and the booking proxy", () => {
    const offenders = codeFiles
      .filter((file) => file.path !== "/src/lib/api/http.ts" && file.path !== "/src/lib/booking/backend.ts")
      .filter((file) => /\bfetch\s*\(/.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("src reads no environment variables except SITE_URL in lib/seo.ts, the API settings in lib/api/config.ts and the start-up check in instrumentation.ts", () => {
    const offenders = codeFiles
      .filter((file) => !["/src/lib/seo.ts", "/src/lib/api/config.ts", "/src/instrumentation.ts"].includes(file.path))
      .filter((file) => /\bprocess\.env\b/.test(file.code))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("src has no XMLHttpRequest, WebSocket or axios", () => {
    const offenders = codeFiles.filter((file) => /\b(XMLHttpRequest|WebSocket|axios)\b/.test(file.code)).map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});

describe("the checks themselves", () => {
  it("catch what they are meant to catch", () => {
    expect(BANNED_CLAIMS.test("Rated 4.9 by our reviews")).toBe(true);
    expect(BANNED_CLAIMS.test("An award-winning clinic")).toBe(true);
    expect(BANNED_CLAIMS.test("ISO certified")).toBe(true);
    expect(BANNED_CLAIMS.test("Doctor reviewing a folder")).toBe(false);
    expect(BANNED_CLAIMS.test("leading-none")).toBe(false);
    expect(BRAND_WORDS.test("In partnership with Apollo")).toBe(true);
    expect(withoutComments("const a = 1; // no ratings here\n/* no awards */ const b = 2;")).not.toMatch(/ratings|awards/);
    expect(withoutComments('const url = "https://example.com";')).toContain("https://example.com");
    expect(withoutImports('import { Inter } from "next/font/google";\nconst a = 1;')).not.toMatch(/google/);
    expect(withoutImports('import {\n  A,\n  B,\n} from "@/x/google";\nconst keep = 1;')).toContain("keep");
    // Only imports are skipped: the same word in a visible string is still caught.
    expect(withoutImports('const label = "Powered by Google";')).toMatch(/Google/);
  });
});

describe("the About page makes no invented claims (FR-061)", () => {
  const aboutText = stringValues(aboutContent);
  const aboutSource = codeFiles.filter((file) => file.path === "/src/app/about/page.tsx" || file.path.startsWith("/src/components/about/"));

  it("has the page and its component to scan", () => {
    expect(aboutSource.length).toBeGreaterThanOrEqual(2);
  });

  it("states that it is a portfolio demo and not a real clinic", () => {
    expect(aboutContent.story[0]).toMatch(/portfolio demo/i);
    expect(aboutContent.story[0]).toMatch(/not a real clinic/i);
  });

  it("has no numbers with years, patients, staff or plus signs, and no founding or history wording", () => {
    const claim = /\d+\s*\+|\d[\d,]*\s*(years?|patients?|doctors?|staff|visits|branches|clinics)\b|\b(since|established|founded in|est\.)\s+\d{4}|\b(founded|established) (in|on)\b/i;
    expect(aboutText.filter((value) => claim.test(value))).toEqual([]);
    expect(aboutSource.filter((file) => claim.test(file.code)).map((file) => file.path)).toEqual([]);
  });

  it("has no claim words or brand names", () => {
    expect(aboutText.filter((value) => BANNED_CLAIMS.test(value) || BRAND_WORDS.test(value))).toEqual([]);
  });
});

describe("honesty text is fixed by the constitution, not by data (K1)", () => {
  it("the constants equal the constitution text", () => {
    expect(DEMO_NOTICE).toBe("Portfolio demo — not a real clinic, not medical advice.");
    expect(CREDIT).toEqual({ text: "Designed & built by Shuaib Ali", href: "https://github.com/Shuaibali0786" });
  });

  it("the recorded clinic response and the sample clinic carry the same text (seed parity)", () => {
    expect(clinicJson.demoNotice).toBe(DEMO_NOTICE);
    expect(clinicJson.credit).toEqual(CREDIT);
    expect(siteConfig.demoNotice).toBe(DEMO_NOTICE);
    expect(siteConfig.credit).toEqual(CREDIT);
  });

  it("the footer and notice bar render the constants even when the clinic data says something else", async () => {
    clinicState.mode = "other-honesty";
    const { unmount } = render(await NoticeBar());
    expect(screen.getByText(DEMO_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText("Totally real clinic.")).not.toBeInTheDocument();
    unmount();

    render(await SiteFooter());
    expect(screen.getByText(DEMO_NOTICE)).toBeInTheDocument();
    const credit = screen.getByRole("link", { name: CREDIT.text });
    expect(credit).toHaveAttribute("href", CREDIT.href);
    expect(screen.queryByText("Totally real clinic.")).not.toBeInTheDocument();
    expect(screen.queryByText("Someone else")).not.toBeInTheDocument();
  });
});
