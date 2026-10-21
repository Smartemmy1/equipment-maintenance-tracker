"""Inspection scheduling and reliability calculations.

Plain functions over ORM objects, with "today" passed in explicitly, so every
rule here can be unit tested for any date without touching the clock.
"""

from datetime import date, timedelta
from statistics import fmean

from app.models import Equipment, Failure
from app.schemas import EquipmentDetail, EquipmentOut, InspectionState, ReliabilityMetrics

HOURS_PER_DAY = 24
AVAILABILITY_WINDOW_DAYS = 365


# ---------- Inspection schedule ----------
def last_inspection(eq: Equipment) -> date | None:
    return max((i.date for i in eq.inspections), default=None)


def next_inspection_due(eq: Equipment) -> date:
    """Due one interval after the last inspection, or after installation if never inspected."""
    start = last_inspection(eq) or eq.installed_on
    return start + timedelta(days=eq.inspection_interval_days)


def inspection_state(due: date, today: date, due_soon_days: int) -> InspectionState:
    days_left = (due - today).days
    if days_left < 0:
        return "overdue"
    if days_left <= due_soon_days:
        return "due_soon"
    return "ok"


def summarize(eq: Equipment, today: date, due_soon_days: int) -> EquipmentOut:
    due = next_inspection_due(eq)
    return EquipmentOut(
        id=eq.id,
        tag=eq.tag,
        name=eq.name,
        category=eq.category,
        location=eq.location,
        criticality=eq.criticality,
        status=eq.status,
        inspection_interval_days=eq.inspection_interval_days,
        installed_on=eq.installed_on,
        notes=eq.notes,
        last_inspection=last_inspection(eq),
        next_inspection_due=due,
        days_until_due=(due - today).days,
        inspection_state=inspection_state(due, today, due_soon_days),
        open_failures=sum(1 for f in eq.failures if f.resolved_on is None),
    )


# ---------- Reliability ----------
def failure_downtime_hours(f: Failure, today: date) -> float:
    """Recorded downtime for resolved failures; time open so far for unresolved ones."""
    if f.resolved_on is not None:
        return f.downtime_hours or 0.0
    return max(0, (today - f.reported_on).days) * HOURS_PER_DAY


def reliability(eq: Equipment, today: date) -> ReliabilityMetrics:
    failures = [f for f in eq.failures if f.reported_on <= today]

    # MTBF: time in service divided by the number of failures in that time.
    days_in_service = max(1, (today - eq.installed_on).days)
    mtbf = round(days_in_service / len(failures), 1) if failures else None

    # MTTR: average repair time of failures that have been fixed.
    repaired = [f.downtime_hours for f in failures if f.downtime_hours is not None]
    mttr = round(fmean(repaired), 1) if repaired else None

    # Availability over the last year (or since installation, if newer).
    window_start = max(eq.installed_on, today - timedelta(days=AVAILABILITY_WINDOW_DAYS))
    window_hours = max(1, (today - window_start).days) * HOURS_PER_DAY
    down = sum(failure_downtime_hours(f, today) for f in failures if f.reported_on >= window_start)
    availability = round(max(0.0, 1 - down / window_hours), 4)

    return ReliabilityMetrics(
        failure_count=len(failures),
        mtbf_days=mtbf,
        mttr_hours=mttr,
        availability=availability,
    )


def detail(eq: Equipment, today: date, due_soon_days: int) -> EquipmentDetail:
    return EquipmentDetail(
        **summarize(eq, today, due_soon_days).model_dump(),
        metrics=reliability(eq, today),
    )
