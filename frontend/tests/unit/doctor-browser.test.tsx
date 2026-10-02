import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DoctorBrowser, DoctorBrowserFallback } from "@/components/doctors/DoctorBrowser";
import { departments } from "@/data/departments";
import { doctors } from "@/data/doctors";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const options = departments.map(({ id, slug, name }) => ({ id, slug, name }));
const cards = () => screen.getAllByRole("article");

beforeEach(() => {
  search = "";
  window.history.replaceState(null, "", "/doctors");
});

describe("DoctorBrowser", () => {
  it("shows all nine sample doctors with a Sample profile label on each", () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    expect(cards()).toHaveLength(9);
    expect(screen.getAllByText("Sample profile")).toHaveLength(9);
    expect(screen.getByRole("status")).toHaveTextContent("Showing all 9 doctors");
  });

  it("shows photo, name, specialty, qualifications, languages, fee and availability on a card", () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    const card = cards()[1] as HTMLElement;
    expect(within(card).getByRole("heading", { level: 3, name: "Dr. Imran Qureshi" })).toBeInTheDocument();
    expect(within(card).getByText("Cardiology")).toBeInTheDocument();
    expect(within(card).getByText("MBBS, FCPS (Cardiology)")).toBeInTheDocument();
    expect(within(card).getByText("Urdu, English")).toBeInTheDocument();
    expect(within(card).getByText("PKR 3,500")).toBeInTheDocument();
    expect(within(card).getByText(/Available|Next available/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View profile: Dr. Imran Qureshi" })).toHaveAttribute("href", "/doctors/dr-imran-qureshi");
  });

  it("filters by department and announces the new count", async () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    await userEvent.selectOptions(screen.getByLabelText("Department"), "Pediatrics");
    expect(cards()).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 of 9 doctors");
    expect(window.location.search).toBe("?department=pediatrics");
  });

  it("searches by name in any case, with or without Dr.", async () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    await userEvent.type(screen.getByLabelText("Search by name"), "DR. sana");
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "Dr. Sana Farooqui" })).toBeInTheDocument();
  });

  it("filters by the day a doctor is available and combines filters", async () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    await userEvent.selectOptions(screen.getByLabelText("Available on"), "Friday");
    const fridayCount = cards().length;
    expect(fridayCount).toBeGreaterThan(0);
    expect(fridayCount).toBeLessThan(9);
    await userEvent.selectOptions(screen.getByLabelText("Department"), "Pediatrics");
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3, name: "Dr. Faisal Chaudhry" })).toBeInTheDocument();
  });

  it("shows the empty state, and Clear filters restores all nine", async () => {
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    await userEvent.type(screen.getByLabelText("Search by name"), "zzzz");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText("No doctors match your filters")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 9 doctors");
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cards()).toHaveLength(9);
    expect(screen.getByLabelText("Search by name")).toHaveValue("");
    expect(window.location.search).toBe("");
  });

  it("starts from the filters in the URL, so going back from a profile keeps them", () => {
    search = "department=cardiology&day=mon";
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    expect(screen.getByLabelText("Department")).toHaveValue("dept-cardiology");
    expect(screen.getByLabelText("Available on")).toHaveValue("mon");
    expect(cards()).toHaveLength(1);
  });

  it("ignores unknown values in the URL", () => {
    search = "department=nope&day=sun&q=";
    render(<DoctorBrowser doctors={doctors} departments={options} />);
    expect(cards()).toHaveLength(9);
  });
});

describe("DoctorBrowserFallback", () => {
  it("renders the full list under the same controls, for the server and for no-JavaScript visitors", () => {
    render(<DoctorBrowserFallback doctors={doctors} departments={options} />);
    expect(cards()).toHaveLength(9);
    expect(screen.getByLabelText("Search by name")).toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
  });
});
