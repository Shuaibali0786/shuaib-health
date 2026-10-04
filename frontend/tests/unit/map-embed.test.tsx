import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MapEmbed } from "@/components/contact/MapEmbed";
import { siteConfig } from "../fixtures/catalog/siteConfig";

const props = { mapArea: siteConfig.mapArea, address: siteConfig.address };

describe("MapEmbed", () => {
  it("shows no map and no frame until the visitor asks, but always shows the text address and notes", () => {
    const { container } = render(<MapEmbed {...props} />);
    expect(container.querySelector("iframe")).toBeNull();
    for (const line of siteConfig.address) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText("Map shows the general area; the address is a sample.")).toBeInTheDocument();
    expect(screen.getByText("Showing the map contacts OpenStreetMap.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show map" })).toBeInTheDocument();
  });

  it("offers a plain text link to OpenStreetMap that opens safely in a new tab", () => {
    render(<MapEmbed {...props} />);
    const link = screen.getByRole("link", { name: /Open this area in OpenStreetMap/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://www.openstreetmap.org/"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the sandboxed, lazy, no-referrer frame for the general area only after Show map is pressed", async () => {
    const { container } = render(<MapEmbed {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Show map" }));
    const frame = container.querySelector("iframe")!;
    expect(frame).toHaveAttribute("title", `Map: ${siteConfig.mapArea.label}`);
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
    const src = new URL(frame.getAttribute("src")!);
    expect(src.origin).toBe("https://www.openstreetmap.org");
    expect(src.pathname).toBe("/export/embed.html");
    expect(src.searchParams.get("bbox")).toBe(siteConfig.mapArea.bbox.join(","));
    expect(src.searchParams.has("marker")).toBe(false);
    expect(screen.queryByRole("button", { name: "Show map" })).not.toBeInTheDocument();
    expect(screen.getByText("Map shows the general area; the address is a sample.")).toBeInTheDocument();
  });
});

describe("MapEmbed with a neutral identity", () => {
  it("renders with no address and no phone link, and does not crash", () => {
    const { container } = render(<MapEmbed mapArea={{ bbox: [0, 0, 0, 0], label: "" }} address={[]} />);
    expect(container.querySelectorAll("a[href^='tel:']")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Show map" })).toBeInTheDocument();
  });
});
