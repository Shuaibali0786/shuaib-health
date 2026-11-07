"""When to send which alert (Feature 012). Thin on purpose: all rules are here, the words are in
``templates`` and the delivery is in ``sender``."""

from datetime import datetime, timedelta

from app.notifications import sender, templates
from app.schemas import AppointmentView
from app.settings import Settings

# A retried request replays the booking it already made; only a booking made just now is announced.
FRESH_WINDOW = timedelta(seconds=120)


def notify_new_booking(
    settings: Settings,
    view: AppointmentView,
    now: datetime,
    transport: sender.Transport = sender._urlopen,
) -> bool:
    """Email the clinic about a booking just made. ``False`` when off, replayed, or not sent."""
    if sender.mail_config(settings) is None:
        return False
    if now - datetime.fromisoformat(view.booked_at) > FRESH_WINDOW:
        return False
    facts = templates.NewBookingFacts(
        reference=view.reference,
        patient_masked=view.patient_name_masked,
        phone_masked=view.mobile_masked,
        doctor=view.doctor.full_name,
        department=view.department.name,
        local_date=view.local_date,
        local_time=view.local_time,
        is_sample=view.is_sample,
    )
    return sender.send(
        settings,
        templates.new_booking_email(facts, link=settings.email_alerts_link),
        transport=transport,
    )
