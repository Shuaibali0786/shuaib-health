from datetime import time

import pytest

from app.seed.loader import SeedData, SeedError, image_key, load_seed_files, validate_seed


@pytest.fixture
def data() -> SeedData:
    return load_seed_files()


def mutate(data: SeedData, path: str, value: object) -> SeedData:
    """Return a copy with one nested field replaced; path like 'doctors.0.department_id'."""
    raw = data.catalog.model_dump()
    target = raw
    *parents, last = path.split(".")
    for part in parents:
        target = target[int(part)] if part.isdigit() else target[part]
    target[int(last) if last.isdigit() else last] = value
    return SeedData(type(data.catalog).model_validate(raw), data.extras)


def test_committed_seed_files_are_valid(data: SeedData) -> None:
    validate_seed(data)
    catalog = data.catalog
    assert len(catalog.departments) == 7
    assert len(catalog.doctors) == 9
    assert len(catalog.lab_test_categories) == 9
    assert len(catalog.lab_tests) == 26
    assert len(catalog.health_packages) == 5
    assert len(data.extras.clinic_rules) == 5


def test_broken_department_reference(data: SeedData) -> None:
    broken = mutate(data, "doctors.0.department_id", "dept-missing")
    with pytest.raises(SeedError, match=data.catalog.doctors[0].slug):
        validate_seed(broken)


def test_duplicate_slug(data: SeedData) -> None:
    broken = mutate(data, "lab_tests.1.slug", data.catalog.lab_tests[0].slug)
    with pytest.raises(SeedError, match="duplicate lab test slug"):
        validate_seed(broken)


def test_overlapping_sessions(data: SeedData) -> None:
    doctor = data.catalog.doctors[0]
    first = doctor.schedule[0]
    overlap = {"day": first.day, "start": first.start, "end": time(23, 0)}
    sessions = [s.model_dump() for s in doctor.schedule] + [overlap]
    broken = mutate(data, "doctors.0.schedule", sessions)
    with pytest.raises(SeedError, match=f"{doctor.slug}: overlapping sessions"):
        validate_seed(broken)


def test_package_priced_above_its_tests(data: SeedData) -> None:
    package = data.catalog.health_packages[0]
    broken = mutate(data, "health_packages.0.package_price_pkr", 10_000_000)
    with pytest.raises(SeedError, match=package.slug):
        validate_seed(broken)


def test_unknown_related_test(data: SeedData) -> None:
    broken = mutate(data, "departments.0.related_test_slugs", ["no-such-test"])
    with pytest.raises(SeedError, match="no-such-test"):
        validate_seed(broken)


def test_image_key_strips_prefix() -> None:
    assert image_key("/images/doctors/a.jpg", "x") == "doctors/a.jpg"
    with pytest.raises(SeedError):
        image_key("https://elsewhere/a.jpg", "x")
