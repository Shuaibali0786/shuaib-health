// Feature 010: the chat widget (launcher loads the panel lazily; panel asks the local provider).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildKnowledgePack } from "@/agent/knowledge";
import { AssistantLauncher } from "@/components/agent/AssistantLauncher";
import { faqGroups } from "@/data/faq";

import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { healthPackages } from "../fixtures/catalog/healthPackages";
import { labTests } from "../fixtures/catalog/labTests";
import { siteConfig } from "../fixtures/catalog/siteConfig";

const packFor = (demo: boolean) => buildKnowledgePack({ site: siteConfig, departments, doctors, labTests, packages: healthPackages, faqGroups, demo });

describe("assistant widget", () => {
  it("opens, answers from the clinic data, and closes with Escape back to the button", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={packFor(false)} />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog", { name: /Ask Shuaib Health/ });
    expect(within(dialog).getByText(/not medical advice/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "Who is asking" })).toBeNull();

    await user.type(within(dialog).getByLabelText("Your question"), "cbc price");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    const log = within(dialog).getByRole("log");
    await waitFor(() => expect(within(log).getByText(/Complete Blood Count \(CBC\) costs PKR 800/)).toBeInTheDocument());
    expect(within(log).getByRole("link", { name: /Complete Blood Count \(CBC\) details/ })).toHaveAttribute("href", "/lab-tests/complete-blood-count");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Ask us" })).toHaveFocus();
  });

  it("offers the clinic-owner guide on the demo", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={packFor(true)} />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Clinic owner" }));
    await user.click(within(dialog).getByRole("button", { name: "Does it work for a dental clinic?" }));
    await waitFor(() => expect(within(dialog).getByRole("link", { name: "See the Dental demo" })).toHaveAttribute("href", "/demo/specialties/dental"));
  });

  it("pauses after 8 questions in a minute", async () => {
    const user = userEvent.setup();
    render(<AssistantLauncher pack={packFor(false)} />);
    await user.click(screen.getByRole("button", { name: "Ask us" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Your question");
    for (let i = 0; i < 9; i++) {
      await user.type(input, "hours{Enter}");
    }
    await waitFor(() => expect(within(dialog).getByText("Please wait a moment before asking again.")).toBeInTheDocument());
    expect(input).toBeDisabled();
  });
});
