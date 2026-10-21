"""Unit tests for scheduling and reliability calculations."""

from datetime import date

from app.models import Category, Equipment, Failure, Inspection, InspectionResult, Severity
from app.services.maintenance import inspection_state, next_inspection_due, reliability

TODAY = date(2026, 6, 15)


def equipment(installed=date(2025, 6, 15), interval=90) -> Equipment:
    return Equipment(
        tag="X-1",
        name="X",
        category=Category.pump,
        location="L",
        inspection_interval_days=interval,
        installed_on=installed,
        inspections=[],
        failures=[],
    )


def test_first_inspection_is_due_one_interval_after_installation():
    assert next_inspection_due(equipment(installed=date(2026, 1, 1))) == date(2026, 4, 1)


def test_due_date_follows_latest_inspection():
    eq = equipment()
    eq.inspections = [
        Inspection(date=date(2026, 5, 1), inspector="A", result=InspectionResult.passed),
        Inspection(date=date(2026, 2, 1), inspector="A", result=InspectionResult.passed),
    ]
    assert next_inspection_due(eq) == date(2026, 7, 30)


def test_inspection_states():
    assert inspection_state(date(2026, 6, 14), TODAY, 14) == "overdue"
    assert inspection_state(date(2026, 6, 15), TODAY, 14) == "due_soon"
    assert inspection_state(date(2026, 6, 29), TODAY, 14) == "due_soon"
    assert inspection_state(date(2026, 6, 30), TODAY, 14) == "ok"


def test_reliability_with_no_failures():
    m = reliability(equipment(), TODAY)
    assert m.failure_count == 0
    assert m.mtbf_days is None
    assert m.mttr_hours is None
    assert m.availability == 1.0


def test_mtbf_mttr_and_availability():
    eq = equipment(installed=date(2025, 6, 15))  # 365 days in service
    eq.failures = [
        Failure(
            reported_on=date(2025, 9, 1),
            description="a",
            severity=Severity.minor,
            resolved_on=date(2025, 9, 2),
            downtime_hours=10,
        ),
        Failure(
            reported_on=date(2026, 3, 1),
            description="b",
            severity=Severity.major,
            resolved_on=date(2026, 3, 3),
            downtime_hours=30,
        ),
    ]
    m = reliability(eq, TODAY)
    assert m.failure_count == 2
    assert m.mtbf_days == 182.5
    assert m.mttr_hours == 20
    assert m.availability == round(1 - 40 / (365 * 24), 4)


def test_open_failure_counts_downtime_so_far():
    eq = equipment()
    eq.failures = [
        Failure(reported_on=date(2026, 6, 13), description="open", severity=Severity.critical)
    ]
    m = reliability(eq, TODAY)
    assert m.mttr_hours is None  # not repaired yet
    assert m.availability == round(1 - 48 / (365 * 24), 4)
