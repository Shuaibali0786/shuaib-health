import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CtaBand } from "@/components/home/CtaBand";
import { DepartmentCard } from "@/components/home/DepartmentCard";
import { DepartmentGrid } from "@/components/home/DepartmentGrid";
import { DoctorCard } from "@/components/home/DoctorCard";
import { EmergencyCard } from "@/components/home/EmergencyCard";
import { FactsBand } from "@/components/home/FactsBand";
import { FeaturedDoctors } from "@/components/home/FeaturedDoctors";
import { HealthTips } from "@/components/home/HealthTips";
import { QuickActions } from "@/components/home/QuickActions";
import { TipCard } from "@/components/home/TipCard";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthTips } from "@/data/healthTips";
import { buildFacts } from "@/data/homeContent";
import { siteConfig } from "../fixtures/catalog/siteConfig";

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);

const BANNED = /rating|review|testimonial|award|certified|accredited|patients served|years of experience|best |leading/i;

describe("QuickActions", () => {
  it("shows the five actions in order, each linking to its page", () => {
    render(<QuickActions />);
    expect(screen.getByRole("heading", { level: 2, name: "How can we help you?" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/doctors",
      "/book-appointment",
      "/lab-tests",
      "/health-packages",
      "/faq#home-sample-collection",
    ]);
    expect(links.map((link) => within(link).getAllByText(/./)[0]?.textContent)).toEqual([
      "Find a Doctor",
      "Book Appointment",
      "Lab Tests",
      "Health Packages",
      "Home Sample Collection",
    ]);
  });
});

describe("DepartmentCard and DepartmentGrid", () => {
  it("shows the photo, name, one line and a link for one department", () => {
    const cardiology = departments[1]!;
    render(<DepartmentCard department={cardiology} />);
    expect(screen.getByRole("heading", { level: 3, name: "Cardiology" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cardiology" })).toHaveAttribute("href", "/departments/cardiology");
    expect(screen.getByText(cardiology.summary)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: cardiology.image.alt })).toBeInTheDocument();
  });

  it("lists all seven departments in order, one link each (no nested links)", async () => {
    const { container } = render(await DepartmentGrid());
    const names = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual([
      "General Medicine",
      "Cardiology",
      "Pediatrics",
      "Gynecology",
      "Dermatology",
      "Dental",
      "Pathology Lab",
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });
});

describe("FactsBand", () => {
  it("shows exactly the four honest facts and no fabricated claims", () => {
    const { container } = render(<FactsBand departmentCount={departments.length} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(buildFacts(departments.length).map((fact) => fact.value)).toEqual(["7", "Online", "Mon–Sat", "Same day"]);
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.textContent).not.toMatch(/\d[\d,]*\+?\s*(patients|doctors|years)/i);
  });

  it("states the opening hours in Karachi time", () => {
    render(<FactsBand />);
    expect(screen.getByText("9 AM – 9 PM PKT")).toBeInTheDocument();
  });
});

describe("EmergencyCard", () => {
  it("has a tap-to-call link to the sample number, labelled as a sample, with advice to go to the nearest ER", async () => {
    render(await EmergencyCard());
    const call = screen.getByRole("link", { name: /\+92 21 0000 0000/ });
    expect(call).toHaveAttribute("href", `tel:${siteConfig.emergencyPhone.tel}`);
    expect(call).toHaveTextContent("(sample)");
    expect(screen.getByText(/go to the nearest emergency room/i)).toBeInTheDocument();
    expect(screen.getByText(/does not reach a real clinic/i)).toBeInTheDocument();
  });
});

describe("DoctorCard and FeaturedDoctors", () => {
  it("shows a Sample badge, specialty, the fee in PKR and a View profile link", () => {
    const doctor = doctors[1]!;
    render(<DoctorCard doctor={doctor} />);
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Dr. Imran Qureshi" })).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
    expect(screen.getByText("PKR 3,500")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View profile: Dr. Imran Qureshi" });
    expect(link).toHaveAttribute("href", "/doctors/dr-imran-qureshi");
    expect(link).toHaveTextContent("View profile");
  });

  it("shows four sample doctors, each marked Sample, and says the details are fictional and the photos are stock photos", async () => {
    const { container } = render(await FeaturedDoctors());
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getAllByText("Sample")).toHaveLength(4);
    expect(screen.getByText(/sample doctors for the demo/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/fictional/);
    expect(container.textContent).toMatch(/stock photos of models/);
    expect(container.textContent).not.toMatch(BANNED);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("has a View all doctors button that opens the Doctors page, like View all tips", async () => {
    render(await FeaturedDoctors());
    expect(screen.getByRole("link", { name: "View all doctors" })).toHaveAttribute("href", "/doctors");
  });

  it("uses the current Sana Farooqui photo from the data file, with no second copy of the path", async () => {
    render(await FeaturedDoctors());
    const sana = doctors.find((doctor) => doctor.slug === "dr-sana-farooqui")!;
    const image = screen.getByAltText(sana.photo.alt);
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain("/images/doctors/dr-sana-farooqui.jpg");
  });
});

describe("TipCard and HealthTips", () => {
  it("shows a Sample badge, the Karachi date and one link", () => {
    const tip = healthTips[0]!;
    render(<TipCard tip={tip} />);
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(screen.getByText("12 Sep 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tip.title })).toHaveAttribute("href", "/health-tips/staying-hydrated");
    expect(screen.getByText(tip.category)).toBeInTheDocument();
  });

  it("shows the three newest tips, newest first, plus a View all tips link", async () => {
    render(await HealthTips());
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Small habits for staying hydrated",
      "A calmer routine for better sleep",
      "Building a balanced plate",
    ]);
    expect(screen.getAllByText("Sample")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "View all tips" })).toHaveAttribute("href", "/health-tips");
  });
});

describe("CtaBand", () => {
  it("closes the page with Book your appointment and a button to the booking page", () => {
    render(<CtaBand />);
    expect(screen.getByRole("heading", { level: 2, name: "Book your appointment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book Appointment" })).toHaveAttribute("href", "/book-appointment");
  });
});

describe("ImageWithFallback", () => {
  it("swaps a failed image for a neutral block that keeps the alt text visible", () => {
    const image = { src: "/images/missing.jpg", alt: "A missing test photo", width: 800, height: 600 };
    const { container } = render(<ImageWithFallback image={image} sizes="100vw" />);
    fireEvent.error(screen.getByRole("img", { name: image.alt }));

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("A missing test photo")).toBeVisible();
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: "800 / 600" });
  });
});

describe("phone layouts", () => {
  it("shows departments as compact two-column cards", async () => {
    const { container } = render(await DepartmentGrid());
    const list = container.querySelector("ul");
    // Two columns up to tablets; from lg a centred wrapping row, so a short last row sits in the middle.
    expect(list).toHaveClass("grid", "grid-cols-2", "lg:flex", "lg:flex-wrap", "lg:justify-center");
    // The decorative "Learn more" row is hidden on phones; summaries are never clipped (text-size safe).
    expect(screen.getAllByText("Learn more")[0]).toHaveClass("max-sm:hidden");
    expect(screen.getByText(departments[0]!.summary).className).not.toMatch(/line-clamp/);
  });

  it("keeps quick actions in two columns, with the last one full width", () => {
    const { container } = render(<QuickActions />);
    expect(container.querySelector("ul")).toHaveClass("grid-cols-2", "lg:grid-cols-5");
    const items = screen.getAllByRole("listitem");
    expect(items[items.length - 1]).toHaveClass("col-span-2", "lg:col-span-1");
  });

  it("makes featured doctors a snap-scrolling swipe row on phones, a grid from sm", async () => {
    const { container } = render(await FeaturedDoctors());
    const list = container.querySelector("ul")!;
    expect(list).toHaveClass("max-sm:snap-x", "max-sm:snap-mandatory", "max-sm:overflow-x-auto", "max-sm:flex");
    expect(list).toHaveClass("grid", "sm:grid-cols-2", "xl:grid-cols-4");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("max-sm:w-[78%]", "max-sm:snap-start", "max-sm:shrink-0");
    }
  });

  it("makes health tips a snap-scrolling swipe row on phones, a grid from sm", async () => {
    const { container } = render(await HealthTips());
    const list = container.querySelector("ul")!;
    expect(list).toHaveClass("max-sm:snap-x", "max-sm:snap-mandatory", "max-sm:overflow-x-auto");
    expect(list).toHaveClass("grid", "sm:grid-cols-2", "lg:grid-cols-3");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("leaves room around swipe-row cards so shadows and focus outlines are not clipped", async () => {
    const { container } = render(await FeaturedDoctors());
    expect(container.querySelector("ul")).toHaveClass("max-sm:px-4", "max-sm:pt-2", "max-sm:pb-6", "max-sm:scroll-pl-4");
  });
});
