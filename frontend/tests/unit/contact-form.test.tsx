import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/contact/ContactForm";

const fetchSpy = vi.spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const submit = () => userEvent.click(screen.getByRole("button", { name: "Send message" }));

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Your name/), "Ayesha Khan");
  await userEvent.type(screen.getByLabelText(/Phone or email/), "0300-0000000");
  await userEvent.type(screen.getByLabelText(/Subject/), "Opening hours");
  await userEvent.type(screen.getByLabelText(/Message/), "Are you open on Saturday evening?");
}

describe("ContactForm", () => {
  it("has a visible label for every field, marked required in text, and turns off the browser's own validation", () => {
    const { container } = render(<ContactForm />);
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    for (const label of [/Your name/, /Phone or email/, /Subject/, /Message/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("(required)")).toHaveLength(4);
  });

  it("shows a summary and a message next to each field on an empty submit, and moves focus to the summary", async () => {
    render(<ContactForm />);
    await submit();
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("There are 4 problems with your message");
    await waitFor(() => expect(summary).toHaveFocus());
    for (const id of ["name", "contact", "subject", "message"]) {
      const field = document.getElementById(id)!;
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field.getAttribute("aria-describedby")).toContain(`${id}-error`);
      expect(document.getElementById(`${id}-error`)).toHaveTextContent(/Enter|must/);
    }
    expect(screen.queryByText(/Messages are not sent/)).not.toBeInTheDocument();
  });

  it("moves focus to a field when its summary link is used", async () => {
    render(<ContactForm />);
    await submit();
    await userEvent.click(await screen.findByRole("link", { name: "Enter your name." }));
    expect(screen.getByLabelText(/Your name/)).toHaveFocus();
  });

  it("keeps what the visitor typed when there are errors, and describes an invalid phone or email", async () => {
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText(/Your name/), "Ayesha Khan");
    await userEvent.type(screen.getByLabelText(/Phone or email/), "not-a-contact");
    await userEvent.type(screen.getByLabelText(/Message/), "short");
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("There are 3 problems with your message");
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText(/Phone or email/)).toHaveValue("not-a-contact");
    expect(screen.getByLabelText(/Message/)).toHaveValue("short");
    expect(screen.getByLabelText(/Your name/)).toHaveAttribute("aria-invalid", "false");
    expect(document.getElementById("contact-error")).toHaveTextContent(/valid phone number/);
  });

  it("on a valid submit says nothing was sent, clears the form and removes the errors", async () => {
    render(<ContactForm />);
    await submit();
    await screen.findByRole("alert");
    await fillValid();
    await submit();
    expect(await screen.findByText("Messages are not sent in this demo yet. Nothing was saved or transmitted.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Messages are not sent in this demo yet");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Your name/)).toHaveValue("");
  });

  it("never calls fetch and never writes to browser storage", async () => {
    render(<ContactForm />);
    await submit();
    await fillValid();
    await submit();
    await screen.findByText(/Messages are not sent/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});
