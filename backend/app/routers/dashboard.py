"""Overview: what is overdue, what is broken, and where downtime comes from."""

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings, get_settings
from app.database import get_db, get_today
from app.models import Equipment, EquipmentStatus
from app.schemas import CategoryDowntime, Dashboard, FailureOut, OpenFailure
from app.services import maintenance

router = APIRouter(prefix="/api", tags=["dashboard"])

UPCOMING_DAYS = 30


@router.get("/dashboard", response_model=Dashboard)
def dashboard(
    db: Session = Depends(get_db),
    today: date = Depends(get_today),
    settings: Settings = Depends(get_settings),
):
    equipment = db.scalars(
        select(Equipment).options(
            selectinload(Equipment.inspections), selectinload(Equipment.failures)
        )
    ).all()
    items = [maintenance.summarize(eq, today, settings.due_soon_days) for eq in equipment]

    upcoming = sorted(
        (e for e in items if e.days_until_due <= UPCOMING_DAYS),
        key=lambda e: (e.days_until_due, e.tag),
    )

    open_failures = sorted(
        (
            OpenFailure(
                **FailureOut.model_validate(f).model_dump(),
                equipment_tag=eq.tag,
                equipment_name=eq.name,
            )
            for eq in equipment
            for f in eq.failures
            if f.resolved_on is None
        ),
        key=lambda f: (f.reported_on, f.id),
        reverse=True,
    )

    year_ago = today - timedelta(days=365)
    downtime: dict = defaultdict(float)
    for eq in equipment:
        for f in eq.failures:
            if year_ago <= f.reported_on <= today:
                downtime[eq.category] += maintenance.failure_downtime_hours(f, today)

    return Dashboard(
        today=today,
        total=len(items),
        out_of_service=sum(e.status == EquipmentStatus.out_of_service for e in items),
        overdue=sum(e.inspection_state == "overdue" for e in items),
        due_soon=sum(e.inspection_state == "due_soon" for e in items),
        open_failures=len(open_failures),
        upcoming=upcoming,
        failures=open_failures,
        downtime_by_category=sorted(
            (CategoryDowntime(category=c, hours=round(h, 1)) for c, h in downtime.items()),
            key=lambda d: d.hours,
            reverse=True,
        ),
    )
