"""Clinic email alerts (Feature 012): the words only. Pure functions, no network, no database.

The emails go to the clinic's own inbox and carry the same masked patient details as the Command
Centre: first name and initial, masked phone, never an address, a reason or a full number.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Email:
    subject: str
    text: str
    html: str


@dataclass(frozen=True)
class NewBookingFacts:
    reference: str
    patient_masked: str
    phone_masked: str
    doctor: str
    department: str
    local_date: str  # "2026-10-06"
    local_time: str  # "10:30"
    is_sample: bool = False


@dataclass(frozen=True)
class DoctorLoad:
    doctor: str
    count: int


@dataclass(frozen=True)
class DailySummaryFacts:
    local_date: str
    today: int
    tomorrow: int
    new_since_yesterday: int
    per_doctor_today: tuple[DoctorLoad, ...] = ()
    clinic_name: str = "Clinic"


def _esc(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _html(title: str, lines: list[str], link: str | None) -> str:
    body = "".join(f'<p style="margin:0 0 8px">{_esc(line)}</p>' for line in lines)
    button = (
        f'<p style="margin:16px 0 0"><a href="{_esc(link)}" style="background:#0d9488;color:#fff;'
        'padding:10px 16px;border-radius:8px;text-decoration:none">Open the Command Centre</a></p>'
        if link
        else ""
    )
    return (
        '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;'
        'color:#0f172a;max-width:520px">'
        f'<h2 style="margin:0 0 12px;font-size:18px">{_esc(title)}</h2>{body}{button}</div>'
    )


def new_booking_email(facts: NewBookingFacts, *, link: str | None = None) -> Email:
    when = f"{facts.local_date} at {facts.local_time}"
    sample = " (sample booking)" if facts.is_sample else ""
    lines = [
        f"{facts.patient_masked} booked {facts.doctor} ({facts.department}) for {when}.{sample}",
        f"Phone {facts.phone_masked} · reference {facts.reference}",
    ]
    subject = f"New booking: {facts.doctor}, {when}"
    text = "\n".join(lines) + (f"\n\nOpen the Command Centre: {link}" if link else "")
    return Email(subject, text, _html("New booking", lines, link))


def daily_summary_email(facts: DailySummaryFacts, *, link: str | None = None) -> Email:
    plural = "" if facts.new_since_yesterday == 1 else "s"
    lines = [
        f"Today {facts.today}, tomorrow {facts.tomorrow}.",
        f"{facts.new_since_yesterday} new booking{plural} in the last 24 hours.",
    ]
    if facts.per_doctor_today:
        lines.append("Today by doctor:")
        lines += [f"  {load.doctor}: {load.count}" for load in facts.per_doctor_today]
    subject = f"{facts.clinic_name} today: {facts.today} booked, tomorrow {facts.tomorrow}"
    text = "\n".join(lines) + (f"\n\nOpen the Command Centre: {link}" if link else "")
    return Email(subject, text, _html(f"Good morning, {facts.local_date}", lines, link))
