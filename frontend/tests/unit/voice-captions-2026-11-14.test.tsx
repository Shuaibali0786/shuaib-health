// Owner real-device test 2026-11-14, item 5: "You said:" confused patients; it is "I heard:" ("Maine suna:" in Roman Urdu).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Captions } from "@/components/agent/voice/Captions";

describe("5: the heard line under the caption", () => {
  it("English: 'I heard: …'", () => {
    render(<Captions you="I need a dentist" assistant="Of course." lang="en" />);
    expect(screen.getByTestId("voice-heard")).toHaveTextContent("I heard: I need a dentist");
    expect(screen.getByTestId("voice-heard")).not.toHaveTextContent("You said");
  });
  it("Roman Urdu: 'Maine suna: …'", () => {
    render(<Captions you="mujhe bukhar hai" assistant="Ji." lang="roman" />);
    expect(screen.getByTestId("voice-heard")).toHaveTextContent("Maine suna: mujhe bukhar hai");
  });
});
