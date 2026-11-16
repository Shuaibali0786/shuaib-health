import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/home/Hero";
import { buildHeroFacts, heroImage } from "@/data/homeContent";
import { siteConfig } from "../fixtures/catalog/siteConfig";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

const BANNED = /rating|review|testimonial|award|certified|accredited|patients served|years of experience|best |leading/i;

describe("Hero", () => {
  it("has one h1 and names the section after it", async () => {
    const { container } = render(await Hero());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("section")).toHaveAttribute("aria-labelledby", "hero-title");
  });

  it("offers Book Appointment and Find a Doctor", async () => {
    render(await Hero());
    expect(screen.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
    expect(screen.getByRole("link", { name: "Find a Doctor" })).toHaveAttribute("href", "/doctors");
  });

  it("shows exactly three fact cards with demo-true facts only", async () => {
    render(await Hero());
    const cards = within(screen.getAllByRole("list").find((list) => !list.hasAttribute("aria-label")) as HTMLElement).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.textContent)).toEqual([
      "Open Mon–Sat, 9 AM – 9 PM PKT",
      "Lab reports online",
      "Home sample collection",
    ]);
    expect(buildHeroFacts(siteConfig.openingHours)).toHaveLength(3);
    expect(buildHeroFacts([])).toHaveLength(2);
  });

  it("uses no fabricated claims anywhere in the hero", async () => {
    const { container } = render(await Hero());
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("shows the hero photo with alt text", async () => {
    render(await Hero());
    const photo = screen.getByRole("img", { name: heroImage.alt });
    expect(photo).toHaveAttribute("width", "1200");
    expect(photo).toHaveAttribute("height", "1500");
    expect(heroImage.src).toBe("/images/hero/hero-doctor.jpg");
    // It is the LCP image: loaded eagerly with a high fetch priority.
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("fetchpriority", "high");
  });
});

describe("Hero: the trust strip and the Talk to Ayesha button (owner 2026-11-15)", () => {
  it("the trust strip counts the real demo data, and says it is sample data", async () => {
    const { departments } = await import("../fixtures/catalog/departments");
    const { doctors } = await import("../fixtures/catalog/doctors");
    const { labTests } = await import("../fixtures/catalog/labTests");
    render(await Hero());
    const strip = screen.getByTestId("trust-strip");
    expect(within(strip).getByText(`${doctors.length} doctors`)).toBeInTheDocument();
    expect(within(strip).getByText(`${departments.length} departments`)).toBeInTheDocument();
    expect(within(strip).getByText(`${labTests.length} lab tests`)).toBeInTheDocument();
    expect(within(strip).getByText("24/7 online booking")).toBeInTheDocument();
    expect(strip).toHaveTextContent("sample data");
  });

  it("without voice: no Talk to Ayesha button and no AI receptionist claim", async () => {
    vi.stubEnv("ASSISTANT_ENABLED", "false");
    vi.stubEnv("VOICE_ENABLED", "false");
    render(await Hero());
    expect(screen.queryByTestId("talk-to-ayesha")).toBeNull();
    expect(screen.getByTestId("trust-strip")).not.toHaveTextContent("AI receptionist");
    vi.unstubAllEnvs();
  });

  it("with voice: the button sits beside Book Appointment, and the strip names the AI receptionist in English and Urdu", async () => {
    vi.stubEnv("ASSISTANT_ENABLED", "true");
    vi.stubEnv("VOICE_ENABLED", "true");
    render(await Hero());
    const talk = screen.getByTestId("talk-to-ayesha");
    expect(talk).toHaveTextContent("Talk to Ayesha — book in 60 seconds");
    expect(screen.getByRole("link", { name: "Book Appointment" })).toBeInTheDocument();
    expect(screen.getByTestId("trust-strip")).toHaveTextContent("AI receptionist in English and Urdu");
    vi.unstubAllEnvs();
  });

  it("the button asks the assistant to open voice mode with a window event", async () => {
    vi.stubEnv("ASSISTANT_ENABLED", "true");
    vi.stubEnv("VOICE_ENABLED", "true");
    const { OPEN_VOICE_EVENT } = await import("@/components/agent/AssistantLauncher");
    const heard = vi.fn();
    window.addEventListener(OPEN_VOICE_EVENT, heard);
    render(await Hero());
    screen.getByTestId("talk-to-ayesha").click();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_VOICE_EVENT, heard);
    vi.unstubAllEnvs();
  });
});
