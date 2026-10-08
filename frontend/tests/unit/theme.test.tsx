import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeCycle, ThemeSwitch } from "@/admin/shell/ThemeToggle";
import { NEXT_THEME, applyTheme, currentPreference, cycleLabel, parsePreference, resolveTheme, themeCookie, watchSystem } from "@/admin/state/theme";

// Light / Night / Auto (US5, FR-045): the cookie, the attributes on <html>, Auto following the device, and the two switches.

let cookieWrites: string[];

beforeEach(() => {
  cookieWrites = [];
  vi.spyOn(document, "cookie", "set").mockImplementation((value) => {
    cookieWrites.push(value);
  });
  delete document.documentElement.dataset.themePref;
  delete document.documentElement.dataset.theme;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preference", () => {
  it("reads only the three choices and falls back to Light", () => {
    expect(["light", "dark", "system", "blue", "", undefined, null].map((value) => parsePreference(value))).toEqual(["light", "dark", "system", "light", "light", "light", "light"]);
  });

  it("Auto means Night only while the device is dark", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("cycles Light, then Night, then Auto, then Light", () => {
    expect(NEXT_THEME).toEqual({ light: "dark", dark: "system", system: "light" });
  });
});

describe("applyTheme", () => {
  it("writes the cc_theme cookie for the staff app, for a year, Lax", () => {
    applyTheme("dark");
    expect(cookieWrites).toEqual(["cc_theme=dark; Path=/admin; SameSite=Lax; Max-Age=31536000"]);
    expect(themeCookie("system")).toBe("cc_theme=system; Path=/admin; SameSite=Lax; Max-Age=31536000");
  });

  it("applies the theme at once, without a reload", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePref).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(currentPreference()).toBe("light");
  });

  it("Auto leaves the colours to the device (CSS) and says so on <html>", () => {
    applyTheme("system");
    expect(document.documentElement.dataset.themePref).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("Auto follows the device live", () => {
  it("reports the device now and every change, and stops when asked", () => {
    let handler: ((event: MediaQueryListEvent) => void) | undefined;
    const query = {
      matches: false,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        handler = listener;
      },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    const seen: boolean[] = [];
    const stop = watchSystem((dark) => seen.push(dark), query);
    expect(seen).toEqual([false]);
    handler?.({ matches: true } as MediaQueryListEvent);
    handler?.({ matches: false } as MediaQueryListEvent);
    expect(seen).toEqual([false, true, false]);
    stop();
    expect(query.removeEventListener).toHaveBeenCalled();
  });
});

describe("the phone's button", () => {
  it("names what is on and what a press does, and cycles Light, Night, Auto", () => {
    render(<ThemeCycle initial="light" />);
    const button = screen.getByRole("button", { name: "Theme: Light. Switch to Night." });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Theme: Night. Switch to Auto." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Theme: Night/ }));
    expect(screen.getByRole("button", { name: "Theme: Auto. Switch to Light." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Theme: Auto/ }));
    expect(screen.getByRole("button", { name: "Theme: Light. Switch to Night." })).toBeInTheDocument();
    expect(cookieWrites.map((write) => write.split(";")[0])).toEqual(["cc_theme=dark", "cc_theme=system", "cc_theme=light"]);
    expect(cycleLabel("system")).toBe("Theme: Auto. Switch to Light.");
  });
});

describe("the sidebar's switch", () => {
  it("shows the chosen theme as pressed, as the server rendered it", () => {
    render(<ThemeSwitch initial="dark" />);
    expect(screen.getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "false");
  });

  it("applies a choice and keeps the phone's button in step", () => {
    render(
      <>
        <ThemeSwitch initial="light" />
        <ThemeCycle initial="light" />
      </>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Night" }));
    });
    expect(screen.getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Theme: Night. Switch to Auto." })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
