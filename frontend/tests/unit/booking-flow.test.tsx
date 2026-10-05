import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingFlow } from "@/components/booking/BookingFlow";
import { departments } from "../fixtures/catalog/departments";
import { doctors } from "../fixtures/catalog/doctors";
import { currentUrl, navigationCalls, resetNavigation } from "./helpers/mock-navigation";

vi.mock("next/navigation", async () => await import("./helpers/mock-navigation"));

const CLINIC_PHONE = { display: "+92 21 111 000 111", tel: "+9221111000111" };
const NO_SLOTS_MESSAGE = "No online slots in the next 14 days — please call the clinic";
const DETAILS_URL = "?department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&time=14:00&step=details";

const slot = (localTime: string, utc: string) => ({
  startsAt: `2026-10-06T${utc}:00Z`,
  endsAt: `2026-10-06T${utc.slice(0, 3)}${String(Number(utc.slice(3)) + 15).padStart(2, "0")}:00Z`,
  localTime,
});

function slotsFor(slug: string, over: { days?: unknown[] } = {}) {
  return {
    doctorSlug: slug,
    timeZone: "Asia/Karachi",
    windowDays: 14,
    generatedAt: "2026-10-05T04:00:00Z",
    days: over.days ?? [
      { date: "2026-10-05", weekday: "mon", status: "not_working", slots: [] },
      { date: "2026-10-06", weekday: "tue", status: "available", slots: [slot("10:00", "05:00"), slot("14:00", "09:00"), slot("18:00", "13:00")] },
      { date: "2026-10-07", weekday: "wed", status: "fully_booked", slots: [] },
      { date: "2026-10-08", weekday: "thu", status: "clinic_closed", holidayName: "Clinic closed (sample holiday)", slots: [] },
    ],
  };
}

const view = {
  reference: "ABCDE-FGHJK",
  status: "confirmed",
  doctor: { slug: "dr-imran-qureshi", fullName: "Dr. Imran Qureshi", specialty: "Cardiology" },
  department: { slug: "cardiology", name: "Cardiology" },
  startsAt: "2026-10-06T09:00:00Z",
  endsAt: "2026-10-06T09:15:00Z",
  localDate: "2026-10-06",
  localTime: "14:00",
  timeZone: "Asia/Karachi",
  feePkr: 3500,
  patientNameMasked: "A**** K****",
  mobileMasked: "0300****567",
  bookedAt: "2026-10-04T09:05:00Z",
  isSample: true,
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

let onPost: Handler;
let slotsBody: (slug: string) => Response;
const fetchMock = vi.fn<Handler>();

function posts() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  slotsBody = (slug) => json(slotsFor(slug));
  onPost = () => json(view, 201);
  fetchMock.mockImplementation((url, init) => {
    if (init?.method === "POST") return onPost(url, init);
    const slug = /\/api\/booking\/slots\/([^/?]+)/.exec(url)?.[1] ?? "";
    return slotsBody(slug);
  });
  resetNavigation();
});

function mount(query = "", over: Partial<{ doctors: typeof doctors }> = {}) {
  resetNavigation(query);
  return render(
    <BookingFlow
      departments={departments}
      doctors={over.doctors ?? doctors}
      clinicPhone={CLINIC_PHONE}
      timeZone="Asia/Karachi"
    />,
  );
}

const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

async function fillDetails(user: ReturnType<typeof userEvent.setup>, over: { mobile?: string } = {}) {
  await user.type(await screen.findByLabelText(/Full name/), "Ali Khan");
  await user.type(screen.getByLabelText(/Mobile number/), over.mobile ?? "0300 1234567");
}

describe("BookingFlow: the steps", () => {
  it("walks department → doctor → date → time → details, moving focus to each heading", async () => {
    const user = userEvent.setup();
    mount();

    expect(await heading("Choose a department")).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Booking steps" });
    expect(within(steps).getByText("Department").closest("li")).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: /Cardiology/ }));
    expect(await heading("Choose a doctor")).toHaveFocus();
    expect(screen.getByText("Dr. Imran Qureshi")).toBeInTheDocument();
    expect(screen.getByText("PKR 3,500")).toBeInTheDocument();
    expect(screen.getAllByText("Sample").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dr. Sana Farooqui")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select Dr. Imran Qureshi" }));
    expect(await heading("Choose a date")).toHaveFocus();
    const tuesday = await screen.findByRole("radio", { name: /Tue 6 Oct/ });
    expect(screen.getByRole("radio", { name: /Mon 5 Oct.*Not available/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Wed 7 Oct.*Fully booked/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Thu 8 Oct.*Clinic closed/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(tuesday);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await heading("Choose a time")).toHaveFocus();
    expect(screen.getByRole("heading", { level: 3, name: "Morning" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Afternoon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Evening" })).toBeInTheDocument();
    expect(screen.getByText(/Pakistan Standard Time/)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "14:00" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await heading("Your details")).toHaveFocus();
    const summary = screen.getByRole("region", { name: "Your appointment" });
    expect(summary).toHaveTextContent("Dr. Imran Qureshi");
    expect(summary).toHaveTextContent("Tue 6 Oct");
    expect(summary).toHaveTextContent("14:00");
    expect(currentUrl()).toBe(`/book-appointment${DETAILS_URL}`);
  });

  it("announces each step politely", async () => {
    const user = userEvent.setup();
    mount();
    const live = await screen.findByTestId("booking-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: /Cardiology/ }));
    await waitFor(() => expect(live).toHaveTextContent("Step 2 of 5: Choose a doctor"));
  });

  it("Back keeps the choices made", async () => {
    const user = userEvent.setup();
    mount("?department=cardiology&doctor=dr-imran-qureshi&date=2026-10-06&step=time");
    expect(await heading("Choose a time")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await heading("Choose a date")).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /Tue 6 Oct/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await heading("Choose a doctor")).toBeInTheDocument();
    expect(currentUrl()).toContain("doctor=dr-imran-qureshi");
    expect(currentUrl()).toContain("date=2026-10-06");
  });

  it("changing the doctor clears the date and time", async () => {
    const user = userEvent.setup();
    mount("?department=general-medicine&doctor=dr-hassan-mirza&date=2026-10-06&time=14:00&step=doctor");
    await user.click(await screen.findByRole("button", { name: "Select Dr. Omar Sheikh" }));
    await heading("Choose a date");
    expect(currentUrl()).toContain("doctor=dr-omar-sheikh");
    expect(currentUrl()).not.toContain("date=");
    expect(currentUrl()).not.toContain("time=");
  });
});

describe("BookingFlow: the details step", () => {
  it("shows the demo notice, referenced by the form", async () => {
    mount(DETAILS_URL);
    await heading("Your details");
    const notice = screen.getByText("Demo site: please don't enter real medical details");
    expect(notice).toHaveAttribute("id", "booking-demo-notice");
    const form = notice.closest("main, section, div")?.querySelector("form");
    expect(form).toHaveAttribute("aria-describedby", "booking-demo-notice");
  });

  it("has a hidden trap field that people and assistive technology skip", async () => {
    const { container } = mount(DETAILS_URL);
    await heading("Your details");
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap?.closest("[aria-hidden='true']") ?? trap).toHaveAttribute("aria-hidden", "true");
    expect(trap).toHaveAttribute("autocomplete", "off");
  });

  it("blocks submit until the rules are accepted, with an accessible error", async () => {
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    const checkbox = screen.getByRole("checkbox", { name: /I accept the clinic rules/ });
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    const message = await screen.findAllByText("Please accept the clinic rules to continue.");
    expect(message.length).toBeGreaterThan(0);
    const describedBy = checkbox.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ").some((id) => document.getElementById(id)?.textContent === "Please accept the clinic rules to continue.")).toBe(true);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("links the rules checkbox to the rules list on the page", async () => {
    mount(DETAILS_URL);
    await heading("Your details");
    expect(screen.getByRole("link", { name: /clinic rules/i })).toHaveAttribute("href", "#clinic-rules");
  });

  it("books: sends the server-checked fields only, a fresh key, and goes to the confirmation page", async () => {
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(navigationCalls.at(-1)).toEqual({ method: "replace", url: "/book-appointment/confirmed/ABCDE-FGHJK" }));
    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0] as [string, RequestInit];
    expect(url).toBe("/api/booking/appointments");
    expect(JSON.parse(init.body as string)).toEqual({
      doctorSlug: "dr-imran-qureshi",
      startsAt: "2026-10-06T09:00:00Z",
      fullName: "Ali Khan",
      mobile: "0300 1234567",
      email: null,
      reason: null,
      acceptRules: true,
      trap: null,
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("keeps personal details out of the URL and out of browser storage", async () => {
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.type(screen.getByLabelText(/Email/), "ali@example.com");
    await user.type(screen.getByLabelText(/Reason/), "Private reason");
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await waitFor(() => expect(posts()).toHaveLength(1));

    const everything = [currentUrl(), ...navigationCalls.map((c) => c.url), JSON.stringify({ ...window.localStorage }), JSON.stringify({ ...window.sessionStorage })].join(" ");
    for (const personal of ["Ali", "Khan", "0300", "ali@example.com", "Private"]) expect(everything).not.toContain(personal);
  });

  it("moves focus to the first invalid field and shows the server's message on a 422", async () => {
    onPost = () => json({ error: { code: "validation_error", message: "m", requestId: "r", details: [{ field: "mobile", issue: "is invalid" }] } }, 422);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    const mobile = screen.getByLabelText(/Mobile number/);
    await waitFor(() => expect(mobile).toHaveFocus());
    expect(mobile).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ali Khan");
  });

  it("tells the visitor when the doctor is no longer bookable, goes back to the doctor step and keeps the form", async () => {
    onPost = () => json({ error: { code: "validation_error", message: "m", requestId: "r", details: [{ field: "doctorSlug", issue: "is not available for online booking" }] } }, 422);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await heading("Choose a doctor")).toBeInTheDocument();
    expect(screen.getByText("This doctor is no longer available for online booking.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select Dr. Imran Qureshi" }));
    await user.click(await screen.findByRole("radio", { name: /Tue 6 Oct/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("radio", { name: "14:00" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText(/Full name/)).toHaveValue("Ali Khan");
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue("0300 1234567");
  });

  it("shows a friendly error, not a code, when the booking fails", async () => {
    onPost = () => json({ error: { code: "internal_error", message: "boom", requestId: "r" } }, 500);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't complete your booking/i);
    expect(alert).not.toHaveTextContent(/internal_error|boom|500/);
    expect(navigationCalls.some((c) => c.method === "replace")).toBe(false);
  });
});

describe("BookingFlow: safe retries", () => {
  const key = (init?: RequestInit) => (init?.headers as Record<string, string>)["Idempotency-Key"];
  async function fillAndConfirm(user: ReturnType<typeof userEvent.setup>) {
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
  }

  it("sends one request for a double click or a repeated Enter, and disables Confirm while it is in flight", async () => {
    let release: (response: Response) => void = () => {};
    onPost = () => new Promise<Response>((resolve) => (release = resolve));
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    const confirm = screen.getByRole("button", { name: "Confirm booking" });
    await user.dblClick(confirm);
    await user.type(screen.getByLabelText(/Full name/), "{Enter}{Enter}");

    expect(await screen.findByRole("button", { name: /Booking/ })).toBeDisabled();
    expect(posts()).toHaveLength(1);
    release(json(view, 201));
    await waitFor(() => expect(navigationCalls.at(-1)).toEqual({ method: "replace", url: "/book-appointment/confirmed/ABCDE-FGHJK" }));
    expect(posts()).toHaveLength(1);
  });

  it.each([502, 503, 504])("on a %i it says it is safe to try again, and Try again reuses the same key", async (status) => {
    let calls = 0;
    onPost = () => (++calls === 1 ? json({ error: { code: "service_unavailable", message: "m", requestId: "r" } }, status) : json(view, 201));
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't confirm your booking yet. It's safe to try again; you won't be booked twice.");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ali Khan");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(navigationCalls.at(-1)).toEqual({ method: "replace", url: "/book-appointment/confirmed/ABCDE-FGHJK" }));
    const [first, second] = posts().map(([, init]) => init as RequestInit);
    expect(key(first)).toMatch(/^[0-9a-f-]{36}$/);
    expect(key(second)).toBe(key(first));
  });

  it("treats a network failure the same way", async () => {
    let calls = 0;
    onPost = () => {
      if (++calls === 1) throw new TypeError("Failed to fetch");
      return json(view, 201);
    };
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/safe to try again/);
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(navigationCalls.some((c) => c.method === "replace")).toBe(true));
    expect(key(posts()[1]?.[1])).toBe(key(posts()[0]?.[1]));
  });

  it("uses a new key when a detail changes between attempts", async () => {
    let calls = 0;
    onPost = () => (++calls === 1 ? json({ error: { code: "service_unavailable", message: "m", requestId: "r" } }, 504) : json(view, 201));
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);
    await screen.findByRole("alert");

    await user.type(screen.getByLabelText(/Reason/), "Cough");
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await waitFor(() => expect(navigationCalls.some((c) => c.method === "replace")).toBe(true));
    expect(key(posts()[1]?.[1])).not.toBe(key(posts()[0]?.[1]));
  });
});

describe("BookingFlow: a slot that was just taken", () => {
  const takenBody = {
    error: { code: "slot_taken", message: "Sorry, this slot was just taken.", requestId: "r" },
    alternatives: [
      { startsAt: "2026-10-06T13:00:00Z", endsAt: "2026-10-06T13:15:00Z", localDate: "2026-10-06", localTime: "18:00" },
      { startsAt: "2026-10-13T05:00:00Z", endsAt: "2026-10-13T05:15:00Z", localDate: "2026-10-13", localTime: "10:00" },
    ],
  };

  it("keeps the details, focuses the alert, and a chosen alternative is booked with a new key", async () => {
    let calls = 0;
    onPost = () => (++calls === 1 ? json(takenBody, 409) : json(view, 201));
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await user.type(await screen.findByLabelText(/Full name/), "Ali Khan");
    await user.type(screen.getByLabelText(/Mobile number/), "0300 1234567");
    await user.type(screen.getByLabelText(/Email/), "ali@example.com");
    await user.type(screen.getByLabelText(/Reason/), "Chest pain");
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sorry, this slot was just taken.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(within(alert).getByRole("button", { name: "Tue 6 Oct, 18:00" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Tue 13 Oct, 10:00" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "See all times" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ali Khan");
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue("0300 1234567");
    expect(screen.getByLabelText(/Email/)).toHaveValue("ali@example.com");
    expect(screen.getByLabelText(/Reason/)).toHaveValue("Chest pain");

    await user.click(within(alert).getByRole("button", { name: "Tue 6 Oct, 18:00" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("Time", { selector: "dt" }).nextElementSibling).toHaveTextContent("18:00");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ali Khan");

    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await waitFor(() => expect(navigationCalls.at(-1)).toEqual({ method: "replace", url: "/book-appointment/confirmed/ABCDE-FGHJK" }));
    expect(posts()).toHaveLength(2);
    const [first, second] = posts().map(([, init]) => init as RequestInit);
    expect(JSON.parse(second?.body as string).startsAt).toBe("2026-10-06T13:00:00Z");
    const key = (init?: RequestInit) => (init?.headers as Record<string, string>)["Idempotency-Key"];
    expect(key(second)).toMatch(/^[0-9a-f-]{36}$/);
    expect(key(second)).not.toBe(key(first));
  });

  it("\"See all times\" returns to the time step", async () => {
    onPost = () => json(takenBody, 409);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
    await user.click(await screen.findByRole("button", { name: "See all times" }));
    await heading("Choose a time");
  });
});

describe("BookingFlow: edge cases", () => {
  it("offers the clinic phone when a doctor has no available day in the window", async () => {
    slotsBody = (slug) =>
      json(
        slotsFor(slug, {
          days: [
            { date: "2026-10-05", weekday: "mon", status: "not_working", slots: [] },
            { date: "2026-10-06", weekday: "tue", status: "fully_booked", slots: [] },
          ],
        }),
      );
    mount("?department=cardiology&doctor=dr-imran-qureshi&step=date");
    expect(await screen.findByText(NO_SLOTS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+92 21 111 000 111/ })).toHaveAttribute("href", `tel:${CLINIC_PHONE.tel}`);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows the same message for a department with no active doctors, rather than hiding it", async () => {
    const user = userEvent.setup();
    mount("", { doctors: doctors.filter((doctor) => doctor.departmentId !== "dept-cardiology") });
    await user.click(await screen.findByRole("button", { name: /Cardiology/ }));
    expect(await screen.findByText(NO_SLOTS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+92 21 111 000 111/ })).toHaveAttribute("href", `tel:${CLINIC_PHONE.tel}`);
  });

  it("says online booking is unavailable when the slots cannot be loaded, and Retry loads them again", async () => {
    slotsBody = () => json({ error: { code: "service_unavailable", message: "m", requestId: "r" } }, 503);
    const user = userEvent.setup();
    mount("?department=cardiology&doctor=dr-imran-qureshi&step=date");
    expect(await screen.findByText("Online booking is temporarily unavailable. Please call the clinic.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+92 21 111 000 111/ })).toBeInTheDocument();

    slotsBody = (slug) => json(slotsFor(slug));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("radio", { name: /Tue 6 Oct/ })).toBeInTheDocument();
  });

  it("falls back to the department step for a link that makes no sense", async () => {
    mount("?doctor=dr-nobody&date=2026-10-06&time=14:00&step=details");
    expect(await heading("Choose a department")).toBeInTheDocument();
  });
});

describe("BookingFlow: abuse protection", () => {
  async function fillAndConfirm(user: ReturnType<typeof userEvent.setup>) {
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox", { name: /I accept the clinic rules/ }));
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));
  }
  const rateLimited = (seconds: string) =>
    json({ error: { code: "rate_limited", message: "Too many requests.", requestId: "r" } }, 429, { "Retry-After": seconds });

  it("on a 429 shows the friendly message with the clinic phone, a countdown, and a disabled Confirm", async () => {
    onPost = () => rateLimited("60");
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many attempts. Please try again later or call the clinic on +92 21 111 000 111.");
    expect(alert).not.toHaveTextContent(/rate_limited|429/);
    expect(screen.getByTestId("booking-cooldown")).toHaveTextContent(/You can try again in (60|59) seconds\./);
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Ali Khan");
    expect(posts()).toHaveLength(1);
  });

  it("never waits longer than two minutes, whatever the server asks", async () => {
    onPost = () => rateLimited("3600");
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    expect(await screen.findByTestId("booking-cooldown")).toHaveTextContent(/You can try again in (120|119) seconds\./);
  });

  it("enables Confirm again once the wait is over", async () => {
    onPost = () => rateLimited("1");
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled(), { timeout: 4000 });
    expect(screen.queryByTestId("booking-cooldown")).not.toBeInTheDocument();
  });

  it("on booking_limit_reached shows the message and the clinic phone", async () => {
    onPost = () =>
      json({ error: { code: "booking_limit_reached", message: "m", requestId: "r" } }, 409);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This mobile number already has the maximum upcoming bookings. Please call the clinic on +92 21 111 000 111.");
    expect(within(alert).getByRole("link", { name: "+92 21 111 000 111" })).toHaveAttribute("href", "tel:+9221111000111");
  });

  it("on request_rejected shows the generic message and the clinic phone", async () => {
    onPost = () => json({ error: { code: "request_rejected", message: "m", requestId: "r" } }, 400);
    const user = userEvent.setup();
    mount(DETAILS_URL);
    await fillAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't process this booking. Please call the clinic on +92 21 111 000 111.");
  });
});
