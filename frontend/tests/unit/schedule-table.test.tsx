import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScheduleTable } from "@/components/doctors/ScheduleTable";
import type { ScheduleSession } from "@/types/content";

const schedule: ScheduleSession[] = [
  { day: "wed", start: "09:00", end: "13:00" },
  { day: "mon", start: "16:00", end: "20:00" },
  { day: "mon", start: "09:00", end: "12:00" },
];

describe("ScheduleTable", () => {
  it("is a table with a caption that names the time zone", () => {
    render(<ScheduleTable schedule={schedule} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText(/Asia\/Karachi/)).toBeInTheDocument();
    expect(table.querySelector("caption")).not.toBeNull();
  });

  it("has column headers and a row header for each weekday, Monday first", () => {
    render(<ScheduleTable schedule={schedule} />);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Day", "Time"]);
    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Monday", "Wednesday"]);
  });

  it("joins a day's sessions in time order on one row", () => {
    render(<ScheduleTable schedule={schedule} />);
    const monday = screen.getByRole("rowheader", { name: "Monday" }).closest("tr");
    expect(monday).toHaveTextContent("9 AM – 12 PM and 4 PM – 8 PM");
    const wednesday = screen.getByRole("rowheader", { name: "Wednesday" }).closest("tr");
    expect(wednesday).toHaveTextContent("9 AM – 1 PM");
  });
});
