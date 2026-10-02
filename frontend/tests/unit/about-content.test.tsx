import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisitSteps } from "@/components/about/VisitSteps";
import { aboutContent } from "@/data/aboutContent";
import { getAboutContent } from "@/lib/content";

describe("about content (data-model)", () => {
  it("has a mission, a story, three to five values and five visit steps", async () => {
    const about = await getAboutContent();
    expect(about.mission.trim().length).toBeGreaterThan(0);
    expect(about.story.length).toBeGreaterThanOrEqual(1);
    expect(about.values.length).toBeGreaterThanOrEqual(3);
    expect(about.values.length).toBeLessThanOrEqual(5);
    expect(about.visitSteps).toHaveLength(5);
    expect(new Set([...about.values, ...about.visitSteps].map((item) => item.id)).size).toBe(about.values.length + 5);
  });

  it("reuses existing photos, each with an Illustrative image caption", () => {
    expect(aboutContent.facilityPhotos.map((photo) => photo.image.src)).toEqual([
      "/images/clinic/clinic-interior.jpg",
      "/images/departments/general-medicine.jpg",
      "/images/departments/pathology-lab.jpg",
      "/images/departments/dental.jpg",
    ]);
    for (const photo of aboutContent.facilityPhotos) expect(photo.caption).toMatch(/^Illustrative image/);
  });

  it("follows the visit order: find, book, visit or home collection, reports, follow up", () => {
    expect(aboutContent.visitSteps.map((step) => step.title)).toEqual([
      "Find a doctor or a test",
      "Book",
      "Visit, or choose home collection",
      "Receive reports online",
      "Follow up",
    ]);
    expect(aboutContent.visitSteps[1]?.text).toMatch(/coming soon/i);
    expect(aboutContent.visitSteps[3]?.text).toMatch(/planned/i);
  });
});

describe("VisitSteps", () => {
  it("renders a numbered ordered list of the five steps", () => {
    render(<VisitSteps steps={aboutContent.visitSteps} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(screen.getByRole("list").tagName).toBe("OL");
    items.forEach((item, index) => expect(item).toHaveTextContent(`Step ${index + 1}`));
  });
});
