import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IllustrativeNote } from "@/components/ui/IllustrativeNote";

describe("IllustrativeNote", () => {
  it("says a doctor photo is a stock photo of a model and that the profile is fictional", () => {
    render(<IllustrativeNote subject="person" />);
    expect(screen.getByText("Stock photo of a model. Sample profile — name and details are fictional.")).toBeInTheDocument();
  });

  it("never claims the person in a photo is not real", () => {
    render(<IllustrativeNote subject="person" />);
    expect(document.body.textContent).not.toMatch(/not a real person/i);
  });

  it("keeps the facility caption for facility photos", () => {
    render(<IllustrativeNote subject="facility" />);
    expect(screen.getByText("Illustrative image, not our actual facility.")).toBeInTheDocument();
  });
});
