"""Clinic email alerts (Feature 012): the words, the on/off rules and a delivery that never raises.
No network: delivery goes through a fake transport."""

import json
import urllib.request
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.notifications import alerts, sender, templates
from app.schemas import AppointmentDepartment, AppointmentDoctor, AppointmentView
from app.settings import Settings
from tests.api.test_maintenance_purge import CRON, GOOD
from tests.conftest import SettingsFactory

NOW = datetime(2026, 10, 5, 4, 0, tzinfo=UTC)
ON = {
    "email_alerts_enabled": True,
    "email_api_key": "re_test_key_not_real",
    "email_alerts_from": "alerts@clinic.example",
    "email_alerts_to": "front-desk@clinic.example, owner@clinic.example",
    "email_alerts_link": "https://clinic.example/admin",
}


def view(booked_at: datetime = NOW) -> AppointmentView:
    return AppointmentView(
        reference="ABCDE-FGHJK",
        status="confirmed",
        doctor=AppointmentDoctor(slug="dr-x", full_name="Dr. Omar Sheikh", specialty="Cardiology"),
        department=AppointmentDepartment(slug="cardiology", name="Cardiology"),
        starts_at="2026-10-06T05:30:00Z",
        ends_at="2026-10-06T05:45:00Z",
        local_date="2026-10-06",
        local_time="10:30",
        time_zone="Asia/Karachi",
        fee_pkr=2500,
        patient_name_masked="Ayesha K.",
        mobile_masked="0300****567",
        booked_at=booked_at.isoformat().replace("+00:00", "Z"),
        is_sample=False,
    )


class Recorder:
    def __init__(self, status: int = 200, error: Exception | None = None) -> None:
        self.sent: list[urllib.request.Request] = []
        self.status = status
        self.error = error

    def __call__(self, request: urllib.request.Request, timeout: int) -> int:
        self.sent.append(request)
        if self.error:
            raise self.error
        return self.status


def test_the_new_booking_email_has_the_masked_details_and_the_link() -> None:
    facts = templates.NewBookingFacts(
        "ABCDE-FGHJK",
        "Ayesha K.",
        "0300****567",
        "Dr. Omar Sheikh",
        "Cardiology",
        "2026-10-06",
        "10:30",
    )
    mail = templates.new_booking_email(facts, link="https://clinic.example/admin")
    assert mail.subject == "New booking: Dr. Omar Sheikh, 2026-10-06 at 10:30"
    for part in ("Ayesha K.", "0300****567", "ABCDE-FGHJK", "https://clinic.example/admin"):
        assert part in mail.text and part in mail.html


def test_html_in_a_name_cannot_inject_markup() -> None:
    facts = templates.NewBookingFacts(
        "R", "<b>x</b>", "0300****567", "Dr. A & B", "D", "2026-10-06", "10:30"
    )
    assert "<b>x</b>" not in templates.new_booking_email(facts).html
    assert "Dr. A &amp; B" in templates.new_booking_email(facts).html


def test_the_morning_summary_says_today_and_tomorrow() -> None:
    facts = templates.DailySummaryFacts(
        "2026-10-05",
        today=8,
        tomorrow=5,
        new_since_yesterday=3,
        per_doctor_today=(templates.DoctorLoad("Dr. Omar Sheikh", 4),),
    )
    mail = templates.daily_summary_email(facts)
    assert mail.subject == "Clinic today: 8 booked, tomorrow 5"
    assert "Today 8, tomorrow 5." in mail.text
    assert "3 new bookings in the last 24 hours." in mail.text
    assert "Dr. Omar Sheikh: 4" in mail.text
    one = templates.daily_summary_email(templates.DailySummaryFacts("d", 1, 1, 1))
    assert "1 new booking in the last 24 hours." in one.text


def test_it_is_off_by_default_and_when_not_fully_set_up(settings_factory: SettingsFactory) -> None:
    assert sender.mail_config(settings_factory()) is None
    partial = settings_factory(email_alerts_enabled=True, email_api_key="k" * 20)
    assert sender.mail_config(partial) is None  # no sender, no recipients
    recorder = Recorder()
    assert sender.send(partial, templates.Email("s", "t", "h"), transport=recorder) is False
    assert recorder.sent == []


def test_a_send_posts_the_email_with_the_key_in_the_header_only(
    settings_factory: SettingsFactory,
) -> None:
    settings = settings_factory(**ON)
    recorder = Recorder()
    assert sender.send(settings, templates.Email("Subj", "Body", "<p>Body</p>"), transport=recorder)
    (request,) = recorder.sent
    assert request.full_url == "https://api.resend.com/emails"
    assert request.get_header("Authorization") == "Bearer re_test_key_not_real"
    body = json.loads(request.data)  # type: ignore[arg-type]
    assert body["to"] == ["front-desk@clinic.example", "owner@clinic.example"]
    assert "re_test_key_not_real" not in json.dumps(body)


@pytest.mark.parametrize(
    "recorder", [Recorder(status=500), Recorder(error=TimeoutError("slow")), Recorder(status=401)]
)
def test_a_failed_send_returns_false_and_never_raises(
    settings_factory: SettingsFactory, recorder: Recorder, caplog: pytest.LogCaptureFixture
) -> None:
    ok = sender.send(settings_factory(**ON), templates.Email("s", "t", "h"), transport=recorder)
    assert ok is False
    assert "re_test_key_not_real" not in caplog.text


def test_only_a_booking_made_just_now_is_announced(settings_factory: SettingsFactory) -> None:
    settings = settings_factory(**ON)
    recorder = Recorder()
    fresh = view(NOW - timedelta(seconds=5))
    assert alerts.notify_new_booking(settings, fresh, NOW, transport=recorder) is True
    assert len(recorder.sent) == 1
    # The replay of an old booking (a retried request) is not announced again.
    old = view(NOW - timedelta(hours=3))
    assert alerts.notify_new_booking(settings, old, NOW, transport=recorder) is False
    assert len(recorder.sent) == 1


def test_nothing_is_sent_when_the_flag_is_off(settings_factory: SettingsFactory) -> None:
    assert alerts.notify_new_booking(settings_factory(), view(), NOW) is False


def test_the_daily_summary_route_is_hidden_without_the_cron_secret_and_a_no_op_while_off(
    settings_factory: SettingsFactory,
) -> None:
    settings: Settings = settings_factory(maintenance_via_cron=True, cron_secret=CRON)
    client = TestClient(create_app(settings))
    url = "/internal/maintenance/daily-summary"
    assert client.get(url).status_code == 404
    assert client.get(url, headers={"Authorization": "Bearer wrong"}).status_code == 404
    response = client.get(url, headers=GOOD)
    assert (response.status_code, response.json()) == (200, {"status": "disabled"})
