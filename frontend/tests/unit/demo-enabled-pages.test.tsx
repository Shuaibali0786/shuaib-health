import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AboutPage from "@/app/(site)/about/page";
import LoginPage from "@/app/(admin)/admin/login/page";
import { SiteFooter } from "@/components/layout/SiteFooter";

import { clinicState } from "./helpers/catalog-api-mock";

// DEMO_ENABLED on and off, page by page (spec 006): the footer, the About page and the sign-in page.

vi.mock("@/lib/api/cached", async () => (await import("./helpers/catalog-api-mock")).catalogApiMock);
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: () => undefined, useRouter: () => ({ replace: () => undefined }) }));
vi.mock("@/admin/lib/server", () => ({ getViewer: async () => ({ kind: "signed-out" }) }));

const DEMO_BUTTON = /view demo dashboard/i;

beforeEach(() => {
  clinicState.mode = "ok";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("DEMO_ENABLED on", () => {
  beforeEach(() => vi.stubEnv("DEMO_ENABLED", "true"));

  it("the footer has no demo button (the gold top bar carries the entry)", async () => {
    render(await SiteFooter());
    expect(screen.queryByRole("button", { name: DEMO_BUTTON })).toBeNull();
  });

  it("the About page offers the demo", async () => {
    render(await AboutPage());
    expect(screen.getByRole("button", { name: DEMO_BUTTON })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "See how the clinic team works" })).toBeInTheDocument();
  });

  it("the sign-in page offers the demo as a prominent button", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) } as Parameters<typeof LoginPage>[0]));
    const button = screen.getByRole("button", { name: DEMO_BUTTON });
    expect(button).toHaveClass("btn", "btn-gold", "btn-block");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("DEMO_ENABLED off", () => {
  beforeEach(() => vi.stubEnv("DEMO_ENABLED", "false"));

  it("the footer has no demo button", async () => {
    const { container } = render(await SiteFooter());
    expect(screen.queryByRole("button", { name: DEMO_BUTTON })).toBeNull();
    expect(container.querySelector("[data-demo-entry]")).toBeNull();
  });

  it("the About page has no demo section", async () => {
    const { container } = render(await AboutPage());
    expect(screen.queryByRole("button", { name: DEMO_BUTTON })).toBeNull();
    expect(screen.queryByRole("heading", { name: "See how the clinic team works" })).toBeNull();
    expect(container.querySelector("[data-demo-entry]")).toBeNull();
  });

  it("the sign-in page keeps the form but has no demo", async () => {
    const { container } = render(await LoginPage({ searchParams: Promise.resolve({}) } as Parameters<typeof LoginPage>[0]));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: DEMO_BUTTON })).toBeNull();
    expect(container.querySelector(".auth-demo")).toBeNull();
    expect(container.querySelector("[data-demo-entry]")).toBeNull();
  });
});
