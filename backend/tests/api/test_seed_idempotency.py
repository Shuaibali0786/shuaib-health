import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from app.seed.loader import DATA_DIR as SEED_DIR
from app.seed.loader import seed_connection
from tests.api.parity import load_catalog

pytestmark = pytest.mark.db

TABLES = (
    "clinic_settings",
    "clinic_rule",
    "lab_test_category",
    "department",
    "lab_test",
    "doctor",
    "doctor_weekly_schedule",
    "health_package",
    "department_related_test",
    "lab_test_related_department",
    "health_package_test",
    "doctor_leave",
    "clinic_holiday",
)


def expected_counts() -> dict[str, int]:
    catalog = load_catalog()
    booking = json.loads((SEED_DIR / "booking.json").read_text(encoding="utf-8"))
    return {
        "clinic_settings": 1,
        "clinic_rule": 5,
        "lab_test_category": len(catalog["labTestCategories"]),
        "department": len(catalog["departments"]),
        "lab_test": len(catalog["labTests"]),
        "doctor": len(catalog["doctors"]),
        "doctor_weekly_schedule": sum(len(d["schedule"]) for d in catalog["doctors"]),
        "health_package": len(catalog["healthPackages"]),
        "department_related_test": sum(len(d["relatedTestSlugs"]) for d in catalog["departments"]),
        "lab_test_related_department": sum(
            len(t["relatedDepartmentIds"]) for t in catalog["labTests"]
        ),
        "health_package_test": sum(len(p["testSlugs"]) for p in catalog["healthPackages"]),
        "doctor_leave": len(booking["leave"]),
        "clinic_holiday": len(booking["holidays"]),
    }


def counts(session: Session) -> dict[str, int]:
    return {t: session.execute(text(f"SELECT count(*) FROM {t}")).scalar_one() for t in TABLES}


def ids_by_slug(session: Session) -> dict[str, str]:
    result: dict[str, str] = {}
    for table in ("department", "doctor", "lab_test", "lab_test_category", "health_package"):
        rows = session.execute(text(f"SELECT slug, id FROM {table}")).all()
        result.update({f"{table}:{slug}": str(row_id) for slug, row_id in rows})
    return result


def run_seed_again(session: Session) -> None:
    seed_connection(session.connection())


def test_database_matches_the_mock_counts(db_session: Session) -> None:
    assert counts(db_session) == expected_counts()


def test_three_runs_keep_counts_and_ids(db_session: Session) -> None:
    before_ids = ids_by_slug(db_session)
    for _ in range(3):
        run_seed_again(db_session)
        assert counts(db_session) == expected_counts()
        assert ids_by_slug(db_session) == before_ids


def test_everything_seeded_is_marked_sample_and_active(db_session: Session) -> None:
    for table in ("department", "doctor", "lab_test", "health_package", "clinic_rule"):
        flags = db_session.execute(
            text(f"SELECT bool_and(is_sample), bool_and(is_active) FROM {table}")
        ).one()
        assert tuple(flags) == (True, True), table
    assert db_session.execute(text("SELECT is_sample FROM clinic_settings")).scalar_one() is True


def test_changed_sample_values_are_restored(db_session: Session) -> None:
    slug = load_catalog()["labTests"][0]["slug"]
    original = load_catalog()["labTests"][0]["pricePkr"]
    db_session.execute(text("UPDATE lab_test SET price_pkr = 1 WHERE slug = :s"), {"s": slug})
    db_session.execute(text("UPDATE clinic_settings SET name = 'Changed'"))
    db_session.execute(text("UPDATE clinic_rule SET text = 'Changed' WHERE sort_order = 1"))
    run_seed_again(db_session)
    price = db_session.execute(
        text("SELECT price_pkr FROM lab_test WHERE slug = :s"), {"s": slug}
    ).scalar_one()
    assert price == original
    assert (
        db_session.execute(text("SELECT name FROM clinic_settings")).scalar_one()
        == (load_catalog()["siteConfig"]["name"])
    )
    assert db_session.execute(
        text("SELECT text FROM clinic_rule WHERE sort_order = 1")
    ).scalar_one() != ("Changed")


def test_deleted_children_are_recreated(db_session: Session) -> None:
    db_session.execute(text("DELETE FROM doctor_weekly_schedule"))
    db_session.execute(text("DELETE FROM health_package_test"))
    run_seed_again(db_session)
    assert counts(db_session) == expected_counts()


def test_rows_outside_the_seed_are_left_alone(db_session: Session) -> None:
    db_session.execute(
        text(
            "INSERT INTO department (slug, name, summary, image_key, image_alt, image_width, "
            "image_height, sort_order, overview, is_sample) VALUES ('extra-dept', 'Extra', "
            "'Extra', 'x.jpg', 'x', 10, 10, 99, 'Extra', false)"
        )
    )
    run_seed_again(db_session)
    row = db_session.execute(
        text("SELECT is_sample FROM department WHERE slug = 'extra-dept'")
    ).all()
    assert len(row) == 1
    assert row[0][0] is False


def test_api_etag_is_stable_across_runs(client: TestClient, db_session: Session) -> None:
    etags = []
    for _ in range(3):
        run_seed_again(db_session)
        etags.append(client.get("/api/v1/doctors").headers["etag"])
    assert len(set(etags)) == 1


def test_sample_leave_and_holiday_are_placed_inside_the_window(db_session: Session) -> None:
    run_seed_again(db_session)
    leave = db_session.execute(
        text(
            "SELECT count(*) FROM doctor_leave WHERE is_sample "
            "AND starts_at >= now() - interval '1 day' AND ends_at <= now() + interval '16 days'"
        )
    ).scalar_one()
    holidays = db_session.execute(
        text(
            "SELECT count(*) FROM clinic_holiday WHERE is_sample "
            "AND holiday_date BETWEEN current_date - 1 AND current_date + 15"
        )
    ).scalar_one()
    assert leave == expected_counts()["doctor_leave"]
    assert holidays == expected_counts()["clinic_holiday"]


def test_leave_added_by_the_clinic_survives_a_reseed(db_session: Session) -> None:
    doctor_id = db_session.execute(text("SELECT id FROM doctor LIMIT 1")).scalar_one()
    db_session.execute(
        text(
            "INSERT INTO doctor_leave (doctor_id, starts_at, ends_at, is_sample) "
            "VALUES (:d, now(), now() + interval '1 hour', false)"
        ),
        {"d": doctor_id},
    )
    run_seed_again(db_session)
    manual = db_session.execute(
        text("SELECT count(*) FROM doctor_leave WHERE NOT is_sample")
    ).scalar_one()
    assert manual == 1
