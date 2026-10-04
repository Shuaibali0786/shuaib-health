import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BeforeYourVisit } from "@/components/contact/BeforeYourVisit";
import clinicRulesJson from "../fixtures/api/clinic-rules.json";

const rules = clinicRulesJson.items;

describe("BeforeYourVisit", () => {
  it("shows the heading and every rule, in the order given", () => {
    render(<BeforeYourVisit rules={rules} />);
    expect(screen.getByRole("heading", { level: 2, name: "Before your visit" })).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(rules.length);
    items.forEach((item, index) => expect(item).toHaveTextContent(rules[index]!.text));
  });

  it("is an ordered list, named by its heading section", () => {
    const { container } = render(<BeforeYourVisit rules={rules} />);
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelector("section")).toHaveAttribute("aria-labelledby", "before-your-visit-title");
  });

  it("renders nothing, not even a heading, when there are no rules", () => {
    const { container } = render(<BeforeYourVisit rules={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
